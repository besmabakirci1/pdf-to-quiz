import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildQuizzesFromPdfText,
  questionNeedsPageFigure,
} from './lib/parseKendimizi'
import { loadPdfQuizBundle } from './lib/pdfQuizBundle'
import {
  docFingerprint,
  loadSolvedQuestionIds,
  persistSolvedQuestionIds,
  questionProgressId,
} from './lib/quizProgress'
import type { QuizQuestion, QuizSection } from './lib/parseKendimizi'

type Phase = 'upload' | 'pick' | 'quiz' | 'done'

export default function App() {
  const [phase, setPhase] = useState<Phase>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sections, setSections] = useState<QuizSection[]>([])
  /** PDF sayfa numarası → JPEG data URL (görsel sorular için) */
  const [pageSnapshots, setPageSnapshots] = useState<Record<number, string>>({})
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [qIndex, setQIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  /** PDF dosya adı + bayt boyutu; localStorage anahtarı */
  const [docFp, setDocFp] = useState<string | null>(null)
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => new Set())

  const activeSection = useMemo(
    () => sections.find((s) => s.id === activeSectionId) ?? null,
    [sections, activeSectionId],
  )
  const question: QuizQuestion | null = activeSection?.questions[qIndex] ?? null

  useEffect(() => {
    if (!docFp) {
      setSolvedIds(new Set())
      return
    }
    setSolvedIds(loadSolvedQuestionIds(docFp))
  }, [docFp])

  const pageFigureSrc = useMemo(() => {
    if (!question?.sourcePage) return null
    if (!questionNeedsPageFigure(question.stem)) return null
    return pageSnapshots[question.sourcePage] ?? null
  }, [question, pageSnapshots])

  const onFile = useCallback(async (file: File | null) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Lütfen bir PDF dosyası seç.')
      return
    }
    setError(null)
    setBusy(true)
    setFileName(file.name)
    try {
      const { markedText, renderPages } = await loadPdfQuizBundle(file)
      const qs = buildQuizzesFromPdfText(markedText)
      const pruned = qs.filter((s) => s.questions.length > 0)
      const totalQ = pruned.reduce((a, s) => a + s.questions.length, 0)
      if (pruned.length === 0 || totalQ === 0) {
        setError(
          'Çoktan seçmeli bölüm bulunamadı. «Kendimizi Sınayalım» veya «neler öğrendik yanıt anahtarı» sonrası sorular okunamadı; PDF seçilebilir metin içermeli (taranmış görüntü değil).',
        )
        setSections([])
        setPageSnapshots({})
        setDocFp(null)
        setPhase('upload')
        return
      }
      const pagesToRaster = new Set<number>()
      for (const s of pruned) {
        for (const q of s.questions) {
          if (
            q.sourcePage !== undefined &&
            questionNeedsPageFigure(q.stem)
          ) {
            pagesToRaster.add(q.sourcePage)
          }
        }
      }
      const snaps =
        pagesToRaster.size > 0
          ? await renderPages([...pagesToRaster])
          : {}
      setPageSnapshots(snaps)
      setSections(pruned)
      setDocFp(docFingerprint(file.name, file.size))
      setPhase('pick')
    } catch {
      setError('PDF okunamadı. Dosya bozuk olabilir veya taranmış (foto) bir PDF olabilir.')
      setSections([])
      setPageSnapshots({})
      setDocFp(null)
      setPhase('upload')
    } finally {
      setBusy(false)
    }
  }, [])

  const startQuiz = (id: string) => {
    setActiveSectionId(id)
    setQIndex(0)
    setPicked(null)
    setRevealed(false)
    setPhase('quiz')
  }

  const backToUnits = () => {
    setPhase('pick')
    setActiveSectionId(null)
    setQIndex(0)
    setPicked(null)
    setRevealed(false)
  }

  const next = () => {
    if (!activeSection) return
    if (qIndex + 1 < activeSection.questions.length) {
      setQIndex((i) => i + 1)
      setPicked(null)
      setRevealed(false)
    } else {
      setPhase('done')
    }
  }

  const prev = () => {
    if (qIndex <= 0) return
    setQIndex((i) => i - 1)
    setPicked(null)
    setRevealed(false)
  }

  const pickOption = (key: string) => {
    if (revealed) return
    setPicked(key)
    setRevealed(true)
    if (!docFp || !activeSection || !question) return
    const id = questionProgressId(activeSection.id, question.number)
    setSolvedIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev).add(id)
      persistSolvedQuestionIds(docFp, next)
      return next
    })
  }

  const withKeyCount = (s: QuizSection) =>
    s.questions.filter((q) => q.correctKey).length

  const solvedCountInSection = (s: QuizSection) =>
    s.questions.filter((q) =>
      solvedIds.has(questionProgressId(s.id, q.number)),
    ).length

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">PDF → alıştırma</p>
        <h1>Kendimizi Sınayalım</h1>
        <p className="lede">
          Ders kitabı PDF’lerindeki <strong>Kendimizi Sınayalım</strong> bölümlerini
          tarar; çoktan seçmeli soruları çıkarır. Şekil / işaret / «yukarıdaki»
          gibi görsel gerektiren sorularda ilgili PDF sayfasını yüksek çözünürlükte
          gösterir. Mümkünse yanıt anahtarını eşleştirir. Her şey tarayıcıda kalır.
        </p>
      </header>

      {phase === 'upload' && (
        <label className="dropzone">
          <input
            type="file"
            accept="application/pdf"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          <div className="drop-inner">
            {busy ? (
              <span>PDF okunuyor, gerekirse sayfa görselleri çiziliyor…</span>
            ) : (
              <>
                <span className="drop-title">PDF’yi buraya bırak veya tıkla</span>
                <span className="drop-hint">Örn. TÜRK TİYATROSU kitabı</span>
              </>
            )}
          </div>
        </label>
      )}

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      {fileName && phase !== 'upload' && (
        <p className="file-tag">
          <span className="file-name">{fileName}</span>
          <span className="file-tag-hint muted">
            Çözülen sorular bu cihazda saklanır (aynı dosya adı ve boyutu).
          </span>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setPhase('upload')
              setSections([])
              setPageSnapshots({})
              setFileName(null)
              setDocFp(null)
              setError(null)
              setActiveSectionId(null)
            }}
          >
            Başka dosya
          </button>
        </p>
      )}

      {phase === 'pick' && sections.length > 0 && (
        <section className="panel">
          <h2>Üniteler</h2>
          <p className="muted">
            {sections.length} bölüm bulundu. İstediğin üniteye gir.
          </p>
          <ul className="unit-list">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="unit-card"
                  onClick={() => startQuiz(s.id)}
                >
                  <span className="unit-title">{s.unitTitle}</span>
                  <span className="unit-meta">
                    {s.questions.length} soru
                    {withKeyCount(s) > 0
                      ? ` · ${withKeyCount(s)} için cevap anahtarı`
                      : ''}
                    {docFp && solvedCountInSection(s) > 0
                      ? ` · ${solvedCountInSection(s)}/${s.questions.length} çözüldü`
                      : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === 'quiz' && activeSection && question && (
        <section className="quiz">
          <div className="quiz-top">
            <div className="quiz-top-left">
              <button type="button" className="secondary quiz-back" onClick={backToUnits}>
                ← Üniteler
              </button>
              <span className="badge">{activeSection.unitTitle}</span>
            </div>
            <div className="quiz-top-right">
              {qIndex > 0 && (
                <button type="button" className="secondary" onClick={prev}>
                  ← Önceki soru
                </button>
              )}
              <span className="progress">
                Soru {qIndex + 1} / {activeSection.questions.length}
                {docFp && solvedCountInSection(activeSection) > 0
                  ? ` · ${solvedCountInSection(activeSection)} kayıtlı`
                  : ''}
              </span>
            </div>
          </div>

          {pageFigureSrc && (
            <figure className="quiz-figure-wrap">
              <img
                className="quiz-figure"
                src={pageFigureSrc}
                alt={`Kitap PDF sayfa ${question.sourcePage}`}
              />
              <figcaption className="quiz-figure-cap">
                Kitaptaki tam sayfa (PDF {question.sourcePage}). Şıklar ve notlar
                alttaysa sayfayı aşağı kaydırarak görüntüle.
              </figcaption>
            </figure>
          )}
          {question.sourcePage &&
            questionNeedsPageFigure(question.stem) &&
            !pageFigureSrc && (
              <p className="quiz-figure-miss muted">
                Bu soru görsel içeriyor; sayfa görüntüsü üretilemedi (sayfa numarası
                eşleşmedi veya PDF çizilemedi).
              </p>
            )}

          <h2 className="stem">{question.stem}</h2>
          {docFp &&
            solvedIds.has(questionProgressId(activeSection.id, question.number)) &&
            !revealed && (
              <p className="revisit-hint muted">
                Bu soruyu daha önce çözdün; tekrar denemek için bir şık seçebilirsin.
              </p>
            )}

          <ul className="options">
            {question.options.map((o) => {
              const isSel = picked === o.key
              const isCorrect = question.correctKey === o.key
              const showWrong =
                revealed && isSel && question.correctKey && o.key !== question.correctKey
              const cls = [
                'opt',
                isSel && !revealed ? 'opt-picked' : '',
                revealed && isCorrect ? 'opt-correct' : '',
                showWrong ? 'opt-wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    className={cls}
                    onClick={() => pickOption(o.key)}
                    disabled={false}
                  >
                    <span className="opt-key">{o.key.toUpperCase()}</span>
                    <span className="opt-text">{o.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {revealed && (
            <div className="after">
              {!question.correctKey && (
                <p className="muted">
                  Bu soru için PDF’ten cevap anahtarı eşleştirilemedi; kitaptaki
                  «Kendimizi Sınayalım Yanıt Anahtarı» sayfasına bakabilirsin.
                </p>
              )}
              {question.correctKey && picked === question.correctKey && (
                <p className="ok">Doğru.</p>
              )}
              {question.correctKey && picked && picked !== question.correctKey && (
                <p className="bad">
                  Yanlış. Doğru şık: <strong>{question.correctKey.toUpperCase()}</strong>
                </p>
              )}
              {question.reviewTopic && (
                <p className="muted review-hint">
                  Kitapta bu soruyla ilgili bölüm: <em>{question.reviewTopic}</em>
                  {picked && picked !== question.correctKey
                    ? ' — yanıt anahtarı bu konuyu yeniden okumanı öneriyor.'
                    : '.'}
                </p>
              )}
              <div className="quiz-nav-row">
                {qIndex > 0 && (
                  <button type="button" className="secondary" onClick={prev}>
                    ← Önceki soru
                  </button>
                )}
                <button type="button" className="primary" onClick={next}>
                  {qIndex + 1 < activeSection.questions.length
                    ? 'Sonraki soru'
                    : 'Özet'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {phase === 'done' && activeSection && (
        <section className="panel done-panel">
          <h2>Tamamlandı</h2>
          <p className="muted">
            Bu ünitedeki {activeSection.questions.length} soruyu bitirdin.
            {docFp && (
              <>
                {' '}
                Bu PDF için bu üniteden toplam{' '}
                {solvedCountInSection(activeSection)} soru cevabın kayıtlı.
              </>
            )}
          </p>
          <div className="row">
            <button type="button" className="primary" onClick={() => setPhase('pick')}>
              Ünite seç
            </button>
          </div>
        </section>
      )}

      <footer className="foot muted">
        Çıkarım «Kendimizi Sınayalım», «neler öğrendik yanıt anahtarı» ve yanıt
        anahtarı satırlarına göre yapılır; karekodlu LMS yardım sayfası (
        «…ve Yanıt Anahtarı») göz ardı edilir.
      </footer>
    </div>
  )
}

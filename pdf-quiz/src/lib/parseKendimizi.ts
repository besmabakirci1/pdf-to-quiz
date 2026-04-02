export type QuizOption = { key: string; text: string }
export type QuizQuestion = {
  number: number
  stem: string
  options: QuizOption[]
  correctKey?: string
  /** Yanıt anahtarındaki «… konusunu yeniden gözden geçiriniz» tırnak içi konu adı */
  reviewTopic?: string
  /** PDF’te soru numarasının geçtiği sayfa (işaret dili görselleri vb. için raster) */
  sourcePage?: number
}
export type QuizSection = {
  id: string
  unitTitle: string
  bodyRaw: string
  questions: QuizQuestion[]
}

function markedPdfHasPageTags(full: string): boolean {
  return /<<PAGE:\d+>>/.test(full)
}

function pageIndexAtMarkedFull(full: string, idx: number): number | undefined {
  if (!markedPdfHasPageTags(full)) return undefined
  const sub = full.slice(0, Math.max(0, idx))
  let last = 0
  const re = /<<PAGE:(\d+)>>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sub)) !== null) last = Number(m[1])
  return last > 0 ? last : undefined
}

function sourcePageBefore(text: string, pos: number): number | undefined {
  if (!markedPdfHasPageTags(text)) return undefined
  const sub = text.slice(0, Math.max(0, pos))
  let last = 0
  const re = /<<PAGE:(\d+)>>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sub)) !== null) last = Number(m[1])
  return last > 0 ? last : undefined
}

function stripInlinePageTags(s: string): string {
  return s.replace(/<<PAGE:\d+>>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Şık satırı: PDF bazen «c.Yazarı» gibi noktadan sonra boşluk koymaz; buna rağmen durmalıyız */
const OPT_LINE_START = /^\n\s*([a-e])(?:\.|\))/i

function isNextOptionLine(peek: string): boolean {
  return OPT_LINE_START.test(peek)
}

/** Kitapta görsel / işaret / şekil vb. varsa tam sayfa önizlemesi göster */
export function questionNeedsPageFigure(stem: string): boolean {
  return /yukarıdak|aşağıdak|üstteki|alttaki|şekil|görsel|resim|fotoğraf|işaretler|bu\s+işaret|numaralan|harita|grafik|tablo|parçasındaki|verilen\s+şekil|çizim|foto\b|görüntü|diyagram|ölçek|kesit|t\.?\s*i\.?\s*d\b/i.test(
    stem,
  )
}

export function stripPageMarkersFromText(s: string): string {
  return s
    .replace(/<<PAGE:\d+>>\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Satır sonu tire birleştirme + fazla boşluk */
export function normalizeHyphens(text: string): string {
  return text
    .replace(/-\s*\n\s*/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t+/g, ' ')
}

function findUnitTitleBefore(full: string, kendimiziIndex: number): string {
  const back = full.slice(Math.max(0, kendimiziIndex - 900), kendimiziIndex)
  const lines = back
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (/^\d+\.\s*Ünite/i.test(line)) return line
    if (/ünite/i.test(line) && /^[\dİIivx]+\./i.test(line)) return line
    if (/^BÖLÜM\s+\d+/i.test(line)) return line
  }
  return 'Ünite'
}

/**
 * Dijital Toplum: PDF.js'te soru "2\\n \\nMetin...?"; üstte "1\\n \\nListe" çoktan seçmeli gibi durmamalı.
 * Soru metninde genelde hangisi / aşağıdakilerden geçer; pencereyi dar tut
 */
function clipDigitalMcqBlob(raw: string): string {
  const re = /\n(\d{1,2})(?:\s+\t\s*|\s*\n\s+\n)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const n = Number(m[1])
    if (n < 1 || n > 50) continue
    const afterNum = raw.slice(m.index + m[0].length, m.index + m[0].length + 1600)
    if (
      !/(hangis|aşağıdak|yanlış|doğru\s+ver)/i.test(afterNum.replace(/-\s*\n\s*/g, ''))
    )
      continue
    const tail = raw.slice(m.index, m.index + 3500)
    if (/\?/.test(tail) && /\n\s*A\./m.test(tail))
      return raw.slice(m.index + 1).trim()
  }
  return raw.trim()
}

/**
 * «Kendimizi Sınayalım» olmayan kitaplar (ör. Dijital Toplum): sorular genelde
 * gerçek "Yanıt Anahtarı" başlık satırından önce. Alt metin araması yanlış eşleşir.
 */
function sliceBlocksBeforeYanıtAnahtarı(
  full: string,
): { unitTitle: string; body: string }[] {
  const out: { unitTitle: string; body: string }[] = []
  let offset = 0
  for (const line of full.split(/\n/)) {
    const lineStart = offset
    offset += line.length + 1
    if (!/yanıt\s+anahtarı/i.test(line)) continue
    if (/\bve\s+Yanıt\b/i.test(line)) continue
    if (/yanıtınız/i.test(line)) continue
    if (/\.{6,}/.test(line)) continue
    if (line.trim().length < 12) continue
    const y = lineStart + line.search(/yanıt\s+anahtarı/i)
    const chunkStart = Math.max(0, y - 22_000)
    let raw = full.slice(chunkStart, y).trim()
    raw = clipDigitalMcqBlob(raw)
    if (raw.length < 400) continue
    const p0 = pageIndexAtMarkedFull(full, chunkStart)
    if (p0 !== undefined) raw = `<<PAGE:${p0}>>\n${raw}`
    const body = normalizeQuestionBlockLayout(raw)
    const qs = parseMcqBlock(body)
    if (qs.length < 2) continue
    const approx = y - Math.min(raw.length, 12_000)
    out.push({
      unitTitle: findUnitTitleBefore(full, approx),
      body,
    })
  }
  return out
}

/** İçindekiler vb.: hemen ardından soru + a şıkkı yoksa atla (PDF.js satır kırılımlarına toleranslı). */
function looksLikeRealQuizAfterHeader(rest: string): boolean {
  const head = rest.slice(0, 8000)
  return /\n\s*1\.\s+(?!Ünite\b)[\s\S]{0,1200}?(?:\n\s*[a-e][\.\)]\s*|\n\s*[a-e]\s*\t)/i.test(
    head,
  )
}

/** Bazı yeni kitaplarda soru: "6\t metin?" şeklinde (nokta yok). */
function normalizeTabNumberedQuestions(s: string): string {
  let t = s
  t = t.replace(/\n(\d{1,2})\s*\t\s*/g, '\n$1. ')
  t = t.replace(/\n(\d{1,2})\s+\t\s*/g, '\n$1. ')
  t = t.replace(/\n(\d{1,2})\s*\n\s+\n/g, '\n$1. ')
  return t
}

/** Sayfa ortasında «1. Ünite - …» tekrarları soru numarasıyla karışmasın */
function stripRunningUnitHeadings(s: string): string {
  return s.replace(/\n\s*\d+\.\s*Ünite\b[^\n]*/gi, '\n')
}

/** PDF.js: "1." / "a." ile devamı arasında boş satırlar; bazen "e" ile "e." ayrılıyor */
export function normalizeQuestionBlockLayout(s: string): string {
  let t = normalizeHyphens(s).replace(/\r/g, '').trim()
  t = normalizeTabNumberedQuestions(t)
  t = stripRunningUnitHeadings(t)
  t = `\n${t}`
  t = t.replace(/\n\s*(\d+)\.\s*\n+/g, '\n$1. ')
  t = t.replace(/\n\s*([a-e])\.\s*\n+/gi, '\n$1. ')
  t = t.replace(/\n\s*([A-E])[\.\)]\s*/g, (_m, L) => `\n${String(L).toLowerCase()}. `)
  t = t.replace(
    /\n\s*([a-e])\s*\n+([A-ZÇĞİÖŞÜa-züğıöüşç])/g,
    (_m, letter, next) => `\n${letter}. ${next}`,
  )
  return t.trim()
}

function sliceQuestionBodies(full: string): { unitTitle: string; body: string }[] {
  const out: { unitTitle: string; body: string }[] = []
  const marker = /Kendimizi\s+Sınayalım/gi
  let m: RegExpExecArray | null
  while ((m = marker.exec(full)) !== null) {
    const afterHeader = full.slice(m.index + m[0].length)
    if (!looksLikeRealQuizAfterHeader(afterHeader)) continue

    const unitTitle = findUnitTitleBefore(full, m.index)
    const restFromHeader = full.slice(m.index + m[0].length)
    const localStart = restFromHeader.search(/\n\s*1\.\s+(?!Ünite\b)/i)
    if (localStart === -1) continue
    const globalStart = m.index + m[0].length + localStart + 1

    const tail = full.slice(globalStart)
    const endMatch = tail.match(
      /\n\s*(?:Okuma\s+Parçası|Kendimizi\s+Sınayalım\s+Yanıt\s+Anahtarı)(?=\s|$)/i,
    )
    const end = endMatch ? endMatch.index : Math.min(tail.length, 120_000)
    const rawBase = tail.slice(0, end)
    const unitFromBody = rawBase.match(/\n\s*(\d+\.\s*Ünite\b[^\n]+)/i)
    const unitTitleResolved = (unitFromBody?.[1] ?? unitTitle).trim()
    const p0 = pageIndexAtMarkedFull(full, globalStart)
    const rawSlice = p0 !== undefined ? `<<PAGE:${p0}>>\n${rawBase}` : rawBase
    const body = normalizeQuestionBlockLayout(rawSlice)
    if (body.length < 20) continue
    out.push({ unitTitle: unitTitleResolved, body })
  }
  return out
}

export function parseMcqBlock(body: string): QuizQuestion[] {
  const questions: QuizQuestion[] = []
  /** Gövde `sliceQuestionBodies` / dijital fallback’ta zaten normalize edildi; tekrar uygulamak
   *  şık satırlarını (özellikle «b» + satır sonu + devam) bozup c–e’yi yutabiliyordu. */
  const text = body.trim()
  let pos = 0

  while (pos < text.length) {
    const slice = text.slice(pos)
    const leadingWs = slice.match(/^\s*/)?.[0]?.length ?? 0
    pos += leadingWs
    const qStart = pos
    const rest = text.slice(pos)
    let qm = rest.match(/^(\d+)\.\s+([\s\S]*?)(?=\n\s*[a-e](?:\.|\)))/i)
    if (!qm) {
      const rel = rest.search(/\n\s*\d+\.\s+(?!Ünite\b)/i)
      if (rel === -1) break
      pos += rel
      continue
    }
    const qNum = Number(qm[1])
    const stemRaw = qm[2].replace(/\s+/g, ' ').trim()
    const srcPage = sourcePageBefore(text, qStart)
    pos += qm[0].length

    const options: QuizOption[] = []
    while (pos < text.length) {
      const ahead = text.slice(pos)
      const nextQ = ahead.match(/^\n\s*(\d+)\.\s+(?!Ünite\b)/i)
      if (nextQ && options.length > 0) break

      const om = ahead.match(/^\n\s*([a-e])(?:\.|\))\s*([^\n]*)/i)
      if (!om) break
      const key = om[1].toLowerCase()
      let optText = om[2].trim()
      pos += om[0].length

      while (pos < text.length) {
        const peek = text.slice(pos)
        const skipMark = peek.match(/^\n<<PAGE:\d+>>\n?/i)
        if (skipMark) {
          pos += skipMark[0].length
          continue
        }
        if (isNextOptionLine(peek) || /^\n\s*\d+\.\s+(?!Ünite\b)/i.test(peek)) break
        /** `$` satır sonu değil; tüm metin sonu — tek satır devamı hiç eşleşmeyip şık döngüsü erken biter */
        const cont = peek.match(/^\n(\S[^\n]*)/i)
        if (!cont) break
        const contLine = cont[1].trim()
        if (isNextOptionLine(`\n${contLine}`)) break
        optText = `${optText} ${contLine}`.replace(/\s+/g, ' ').trim()
        pos += cont[0].length
      }

      options.push({
        key,
        text: stripInlinePageTags(optText),
      })
      if (key === 'e' || options.length >= 5) {
        const nextPeek = text.slice(pos)
        if (!isNextOptionLine(nextPeek)) break
      }
    }

    const stem = stripInlinePageTags(stemRaw)
    if (stem && options.length >= 2) {
      const q: QuizQuestion = { number: qNum, stem, options }
      if (srcPage !== undefined) q.sourcePage = srcPage
      questions.push(q)
    }
  }

  return questions
}

function parseAnswerChunk(chunk: string): Map<number, string> {
  const map = new Map<number, string>()
  const re = /(?:^|\n)\s*(\d+)\.\s*([a-e])\b/gi
  let x: RegExpExecArray | null
  while ((x = re.exec(chunk)) !== null) {
    map.set(Number(x[1]), x[2].toLowerCase())
  }
  return map
}

/** Cevap harfi + tırnak içi kitap konusu (satır sonu tire ile bölünmüş kelimeler tek satırda birleşir) */
function parseAnswerHints(chunk: string): Map<number, string> {
  const hints = new Map<number, string>()
  const oneLine = chunk
    .replace(/-\s*\n\s*/g, '')
    .replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
    .replace(/\s+/g, ' ')
  const re = /(\d+)\.\s*([a-e])\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(oneLine)) !== null) {
    const n = Number(m[1])
    const after = oneLine.slice(m.index + m[0].length)
    const q = after.match(/"([^"]{2,240})"/)
    if (q) hints.set(n, q[1].replace(/\s+/g, ' ').trim())
  }
  return hints
}

/** «1. A» (boşluk, harf) gibi satırlar */
function parseAnswerChunkLoose(chunk: string): Map<number, string> {
  const map = new Map<number, string>()
  const re = /(?:^|\n)\s*(\d+)\.\s*([A-Ea-e])(?:\s|$)/gm
  let x: RegExpExecArray | null
  while ((x = re.exec(chunk)) !== null) {
    map.set(Number(x[1]), x[2].toLowerCase())
  }
  return map
}

type AnswerBundle = {
  answers: Map<number, string>
  hints: Map<number, string>
}

/** «Kendimizi Sınayalım Yanıt Anahtarı» blokları */
function sliceKendimiziAnswerMaps(full: string): AnswerBundle[] {
  const maps: AnswerBundle[] = []
  const marker = /Kendimizi\s+Sınayalım\s+Yanıt\s+Anahtarı/gi
  let hit: RegExpExecArray | null
  while ((hit = marker.exec(full)) !== null) {
    const tail = full.slice(hit.index + hit[0].length)
    const head = tail.slice(0, 8000)
    if (!/(?:^|\n)\s*1\.\s*[a-e]\b/i.test(head)) continue

    const endM = tail.match(
      /\n\s*(?:Sıra\s+Sizde\s+Yanıt\s+Anahtarı|Kendimizi\s+Sınayalım\s*$|Yararlanılan\s+ve\s+Başvurulabilecek\s+Kaynaklar)(?=\s|$|[.])/i,
    )
    const end = endM ? endM.index : Math.min(tail.length, 80_000)
    const chunk = tail.slice(0, end)
    const answers = parseAnswerChunk(chunk)
    if (answers.size >= 3)
      maps.push({ answers, hints: parseAnswerHints(chunk) })
  }
  return maps
}

/** Dijital Toplum vb.: başlık sonrası "1. A" formatı */
function sliceLooseYanıtAnswerMaps(full: string): AnswerBundle[] {
  const maps: AnswerBundle[] = []
  const lines = full.split(/\n/)
  let cum = 0
  for (const line of lines) {
    if (
      !/yanıt\s+anahtarı/i.test(line) ||
      /\bve\s+Yanıt\b/i.test(line) ||
      /yanıtınız/i.test(line) ||
      /\.{6,}/.test(line) ||
      line.trim().length < 12
    ) {
      cum += line.length + 1
      continue
    }
    const y = cum + line.search(/yanıt\s+anahtarı/i)
    const tail = full.slice(y, y + 9000)
    const answers = parseAnswerChunkLoose(tail)
    if (answers.size >= 2) maps.push({ answers, hints: new Map() })
    cum += line.length + 1
  }
  return maps
}

export function buildQuizzesFromPdfText(fullText: string): QuizSection[] {
  const kBodies = sliceQuestionBodies(fullText)
  const usedFallback = kBodies.length === 0
  const bodies = usedFallback ? sliceBlocksBeforeYanıtAnahtarı(fullText) : kBodies
  const answerMaps = usedFallback
    ? sliceLooseYanıtAnswerMaps(fullText)
    : sliceKendimiziAnswerMaps(fullText)

  return bodies.map((b, idx) => {
    const questions = parseMcqBlock(b.body)
    const bundle = answerMaps[idx]
    if (bundle) {
      for (const q of questions) {
        const c = bundle.answers.get(q.number)
        if (c) q.correctKey = c
        const h = bundle.hints.get(q.number)
        if (h) q.reviewTopic = h
      }
    }
    return {
      id: `u-${idx + 1}`,
      unitTitle: b.unitTitle,
      bodyRaw: stripPageMarkersFromText(b.body),
      questions,
    }
  })
}

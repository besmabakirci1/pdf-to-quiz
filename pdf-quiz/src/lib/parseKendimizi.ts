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

/**
 * «10. Gurbet…» yeni soru; «8. ciltlik…» şık gövdesindeki hacim sayısı (soru değil).
 * «9. masay- fiilinin karşılığı…» gibi küçük harfle başlayan gerçek sorular için kök izi gerekir.
 * 12. Mart vb. zaten (?:[1-9]|10) ile 1–10 dışında tetiklenmez.
 */
function restLooksLikeMcqQuestionStem(rest: string): boolean {
  const compact = rest
    .replace(/-\s*\n\s*/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
  return /hangis|aşağıdak|değildir|doğru\s+olarak|yanlış|verilmiştir|bulunmaktadır|karşılığı|ifadelerden|cümlesinde|sırasıyla|işaret|eşleştirm|verilen|için\s+aşağıdak|örneğinde|nelerdir|nedir/i.test(
    compact,
  )
}

function isLikelyMcqQuestionStemAfterNumber(line: string): boolean {
  const rest = line.replace(/^(?:[1-9]|10)\.\s*/i, '').trim()
  if (!rest) return true
  if (/^ciltlik\b/i.test(rest)) return false
  if (/^[a-züğıöüşç]/.test(rest)) {
    return restLooksLikeMcqQuestionStem(rest)
  }
  return true
}

function peekStartsWithNumberedQuestionHead(peek: string): boolean {
  const m = peek.match(/^\n\s*((?:[1-9]|10)\.\s+[^\n]+)/i)
  return m !== null && isLikelyMcqQuestionStemAfterNumber(m[1])
}

/**
 * Şıklar bittikten sonra gelen açıklama/okuma parçası bazen «e. … vermesi» ile «4. Yukarıda…» arasına
 * sıkışır; PDF’te yeni satır büyük harfle başlayan cümle şık devamından çok prose’dur (şık sarma genelde
 * küçük harf veya satır sonu tire ile sürer).
 */
function shouldStopOptionBeforeProseParagraph(prevOptText: string, contLine: string): boolean {
  const t = contLine.trim()
  const p = prevOptText.replace(/\s+/g, ' ').trim()
  if (t.length < 22 || p.length < 8) return false
  if (/[-\u2013\u2014]\s*$/u.test(p)) return false
  /** «Âşık…» gibi A^ ile başlayan satırlar [A-ZÇĞİÖŞÜ] listesine girmezdi */
  if (!/^\p{Lu}/u.test(t)) return false
  if (/^\p{Ll}/u.test(t)) return false
  /**
   * «Divançe, Hadikatü…» gibi virgüllü tek satırda boşluğa göre az kelime kalabiliyor;
   * yeterli uzunluksa yine araya giren okuma parçasıdır. Kısa satırda ise «İstanbul’da …» şık devamı.
   */
  const wc = t.split(/\s+/).filter(Boolean).length
  if (wc < 4 || (wc < 5 && t.length < 36)) return false
  const prevEndsLikeCompleteWord = /[a-züğıöüşçı)]$/iu.test(p)
  return prevEndsLikeCompleteWord
}

/** Kiril С (U+0421) PDF’te Latin «c.» diye çıkabiliyor; «b. c.» satırı c etiketini yutup şıkları d/e diye kaydırıyor */
const CYRILLIC_CAPITAL_ES = '\u0421'

function optionKeysHaveGap(options: QuizOption[]): boolean {
  if (options.length < 2) return false
  for (let i = 1; i < options.length; i++) {
    if (options[i].key.charCodeAt(0) !== options[i - 1].key.charCodeAt(0) + 1) return true
  }
  return false
}

/** Sıra doğruysa anahtarları a..e olacak şekilde düzelt (metin sırasını değiştirmez) */
function normalizeMangledMcqOptions(options: QuizOption[]): QuizOption[] {
  const out = options.map((o) => ({ ...o }))
  const b = out.find((o) => o.key === 'b')
  if (b && /^c\.?\s*$/i.test(b.text.trim())) b.text = CYRILLIC_CAPITAL_ES
  if (!optionKeysHaveGap(out)) return out
  const letters = ['a', 'b', 'c', 'd', 'e']
  return out.map((o, i) => ({ ...o, key: letters[i] ?? o.key }))
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
  const back = full.slice(Math.max(0, kendimiziIndex - 4500), kendimiziIndex)
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
  /** Bazı sayfalarda «Sınayalım 1. Soru» aynı satırda; satır başı zorunlu değil */
  return /(?:^|\n)\s*1\.\s+(?!Ünite\b)[\s\S]{0,1200}?(?:\n\s*[a-e][.)]\s*|\n\s*[a-e]\s*\t)/i.test(
    head,
  )
}

/**
 * «Kendimizi Sınayalım» quiz başlığı; PDF’te i’ler düşebiliyor («Kendmz Sınayalım»).
 * «… Sınayalım Yanıt Anahtarı» ile karışmasın.
 */
const KENDIMIZI_QUIZ_HEADER =
  /Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım(?!\s+Yanıt)/gi

/** Aynı bozulma yanıt anahtarı satırında da olabiliyor */
const KENDIMIZI_YANIT_BASLIK =
  /Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı/gi

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
  t = t.replace(/\n\s*([A-E])[.)]\s*/g, (_m, L) => `\n${String(L).toLowerCase()}. `)
  t = t.replace(
    /\n\s*([a-e])\s*\n+([A-ZÇĞİÖŞÜa-züğıöüşç])/g,
    (_m, letter, next) => `\n${letter}. ${next}`,
  )
  return t.trim()
}

/**
 * PDF sayfa altlığı: «<<PAGE>> … N. Ünite … Kendimizi Sınayalım Yanıt Anahtarı» gövde ortasında
 * çıkabiliyor; gerçek yanıt başlığı değil, MCQ 9–10 bundan sonra geliyor (9. ünite).
 * Gerçek anahtar sayfasında da üstte «N. Ünite» + sayfa etiketi olur; hemen ardından
 * «1. a.(\\n)Yanıtınız» geliyorsa bu koşu gerçek kesittir (T. İşaret Dili 7. ünite).
 */
function isRunningÜnitePageFooterBeforeYanıt(tail: string, yIdx: number): boolean {
  const back = tail.slice(Math.max(0, yIdx - 900), yIdx)
  const looksLikeRunningHeaderBand =
    /<<PAGE:\d+>>/.test(back) && /\n\s*\d+\.\s*Ünite\b/i.test(back)
  if (!looksLikeRunningHeaderBand) return false
  const len = yanıtHeaderMatchLenAt(tail, yIdx)
  const after = len > 0 ? tail.slice(yIdx + len, yIdx + len + 3500) : ''
  if (/\n\s*1\.\s+[a-e]\b(?:\.?\s*\n\s*Yanıtınız|\s+Yanıtınız)/i.test(after)) return false
  return true
}

/**
 * Basılı yanıt listesi: «1. a Yanıtınız» aynı satırda veya «1. a.» ile «Yanıtınız» satır kırılımıyla
 * (PDF.js; soru gövdesinde yok).
 */
const PRINTED_ANSWER_FIRST_LINE = /\n\s*1\.\s+[a-e]\b(?:\.?\s*\n\s*Yanıtınız|\s+Yanıtınız)/gi

function findPrintedAnswerKeyStart(tail: string): number {
  const m = tail.match(/\n\s*1\.\s+[a-e]\b(?:\.?\s*\n\s*Yanıtınız|\s+Yanıtınız)/i)
  return m?.index !== undefined ? m.index : -1
}

/** Tezkire: metin akışında 4. ünite anahtarı (17. yy. ipuçları) 3. ünite başlığından hemen sonra yanlışlıkla geliyor. */
function hintsLookLikeMisplacedUnit4AfterUnit3(hints: Map<number, string>): boolean {
  const h1 = hints.get(1) ?? ''
  const h2 = hints.get(2) ?? ''
  return /17\.\s*Yüzyıl\s+Şair/i.test(h1) && /17\.\s*Yüzyıl\s+Şair/i.test(h2)
}

function lastPrintedKeyOffsetBefore(full: string, cutExclusive: number, maxBack: number): number {
  const lo = Math.max(0, cutExclusive - maxBack)
  const region = full.slice(lo, cutExclusive)
  PRINTED_ANSWER_FIRST_LINE.lastIndex = 0
  let last = -1
  let m: RegExpExecArray | null
  while ((m = PRINTED_ANSWER_FIRST_LINE.exec(region)) !== null) last = lo + m.index
  return last
}

function tryKendimiziAnswerWorkFromBackward(
  full: string,
  /**
   * «Kendimizi Sınayalım Yanıt Anahtarı» eşleşmesinin başlangıcı; gerçek «1. x Yanıtınız» listesi
   * bazen PDF sırasında bu ifadeden önce geliyor (Tezkire 3. ve 7. ünite).
   */
  headerMatchStart: number,
  sourceUnit: number | undefined,
): string | undefined {
  const start = lastPrintedKeyOffsetBefore(full, headerMatchStart, 92_000)
  if (start < 0) return undefined
  const work = full.slice(start)
  const end = findKendimiziYanıtChunkEnd(work)
  const chunk = work.slice(0, end)
  const answers = parseAnswerChunk(chunk)
  if (answers.size < 3) return undefined
  const hints = parseAnswerHints(chunk)
  if (sourceUnit === 3 && hintsLookLikeMisplacedUnit4AfterUnit3(hints)) return undefined
  return work
}

function tryKendimiziAnswerWorkFromForwardTail(
  tail: string,
  sourceUnit: number | undefined,
  scanCap = 160_000,
): string | undefined {
  const prefix = tail.slice(0, Math.min(tail.length, scanCap))
  PRINTED_ANSWER_FIRST_LINE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PRINTED_ANSWER_FIRST_LINE.exec(prefix)) !== null) {
    const work = tail.slice(m.index)
    const end = findKendimiziYanıtChunkEnd(work)
    const chunk = work.slice(0, end)
    const answers = parseAnswerChunk(chunk)
    if (answers.size < 3) continue
    const hints = parseAnswerHints(chunk)
    if (sourceUnit === 3 && hintsLookLikeMisplacedUnit4AfterUnit3(hints)) continue
    return work
  }
  return undefined
}

function endRespectingEarlyOkumaParçası(
  sub: string,
  endPrimary: number,
  oIdx: number,
): number {
  if (oIdx < 0 || oIdx >= endPrimary) return endPrimary
  const mid = sub.slice(oIdx, endPrimary)
  if (/\n\s*(?:9|10)\.\s+(?!Ünite\b)/i.test(mid)) return endPrimary
  return oIdx
}

const KENDIMIZI_YANIT_LINE_AT_END =
  /\n\s*Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı(?=\s|$)/i

/** Sütun sırası: «Yanıt Anahtarı» 8. sorudan sonra, 9–10 ve gerçek «1. b» listesinden önce geliyor (Tezkire 2. ünite). */
function yanıtHeaderMatchLenAt(sub: string, yIdx: number): number {
  const m = sub
    .slice(yIdx)
    .match(
      /* `\b` Türkçe «…Anahtarı» sonunda `r|ı` arasında yanlış kesiyordu */
      /^\n\s*Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı(?=\s|$)/i,
    )
  return m?.[0].length ?? 0
}

function isMidQuizSpuriousYanıtHeader(sub: string, yIdx: number): boolean {
  const len = yanıtHeaderMatchLenAt(sub, yIdx)
  if (len < 1) return false
  const after = sub.slice(yIdx + len, yIdx + len + 14_000)
  /** «1. aşağıda…» soru köküne düşmesin; basılı anahtar `findPrintedAnswerKeyStart` ile aynı kalıp */
  const keyMatch = after.match(/\n\s*1\.\s+[a-e]\b(?:\.?\s*\n\s*Yanıtınız|\s+Yanıtınız)/i)
  const key1 = keyMatch?.index ?? -1
  const q9 = after.search(/\n\s*9\.\s+(?!Ünite\b)/i)
  const q10 = after.search(/\n\s*10\.\s+(?!Ünite\b)/i)
  const qFirst =
    q9 >= 0 && q10 >= 0
      ? Math.min(q9, q10)
      : q9 >= 0
        ? q9
        : q10 >= 0
          ? q10
          : -1
  if (qFirst < 0) return false
  if (key1 < 0) return true
  return qFirst < key1
}

/**
 * İlk «Yanıt Anahtarı» kesiti: footer gürültüsü veya gövde ortası sahte başlık (Tezkire 2. ünite:
 * 8–10’dan önce yanlış sırada gelen başlık) ise -1 → kesim `findPrintedAnswerKeyStart` ile yapılır.
 */
function findFirstUsableKendimiziYanıtCut(sub: string): number {
  const rel = sub.search(KENDIMIZI_YANIT_LINE_AT_END)
  if (rel < 0) return -1
  if (isRunningÜnitePageFooterBeforeYanıt(sub, rel)) return -1
  if (isMidQuizSpuriousYanıtHeader(sub, rel)) return -1
  return rel
}

/**
 * «Kendimizi Sınayalım» gövdesinin bittiği konum (tail içi offset).
 * Sayfa sınırında geçen «Okuma Parçası» bazen 8. sorudan sonra gelip 9–10’u kesiyordu;
 * bu durumda yalnızca «Yanıt Anahtarı» sınırı kullanılır.
 */
function findKendimiziQuizBlockEnd(tail: string): number {
  const oRe = /\n\s*Okuma\s+Parçası(?=\s|$)/i
  const cap = Math.min(tail.length, 120_000)
  const sub = tail.slice(0, cap)

  const y0 = findFirstUsableKendimiziYanıtCut(sub)
  const oIdx = sub.search(oRe)
  const akIdx = findPrintedAnswerKeyStart(sub)

  let result: number
  if (y0 < 0) {
    let end = akIdx >= 0 ? akIdx : cap
    end = endRespectingEarlyOkumaParçası(sub, end, oIdx)
    result = end
  } else {
    const yIdx = y0
    if (oIdx < 0) result = yIdx
    else if (oIdx < yIdx) {
      const mid = sub.slice(oIdx, yIdx)
      result = /\n\s*(?:9|10)\.\s+(?!Ünite\b)/i.test(mid) ? yIdx : oIdx
    } else result = yIdx
  }

  return result
}

function sliceQuestionBodies(full: string): { unitTitle: string; body: string }[] {
  const out: { unitTitle: string; body: string }[] = []
  KENDIMIZI_QUIZ_HEADER.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = KENDIMIZI_QUIZ_HEADER.exec(full)) !== null) {
    const afterHeader = full.slice(m.index + m[0].length)
    if (!looksLikeRealQuizAfterHeader(afterHeader)) continue

    const unitTitle = findUnitTitleBefore(full, m.index)
    const restFromHeader = full.slice(m.index + m[0].length)
    const q1 = /(?:^|\n)\s*(1\.\s+(?!Ünite\b))/i.exec(restFromHeader)
    if (!q1 || q1.index === undefined) continue
    const globalStart =
      m.index + m[0].length + q1.index + (q1[0].length - q1[1].length)

    const tail = full.slice(globalStart)
    const end = findKendimiziQuizBlockEnd(tail)
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
    const qm = rest.match(/^(\d+)\.\s+([\s\S]*?)(?=\n\s*[a-e](?:\.|\)))/i)
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
      const nextQLine = ahead.match(/^\n\s*((?:[1-9]|10)\.\s+[^\n]+)/i)
      if (nextQLine && options.length > 0) {
        const nql = nextQLine[1]
        if (/\bÜnite\b/i.test(nql) || isLikelyMcqQuestionStemAfterNumber(nql)) break
      }

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
        if (isNextOptionLine(peek) || peekStartsWithNumberedQuestionHead(peek)) break
        /**
         * PDF satırları: «d.» sonrası «\\n \\nBir» gibi boş/seyrek satırlar; eski «\\n(\\S…)» modeli
         * ikinci newline’da kırılıp «Bir» dışındaki devamı ve «e.» şıkkını yutuyordu.
         */
        const cont = peek.match(/^\n+(?:\s*\n)*\s*(\S[^\n]*)/i)
        if (!cont) break
        const contLine = cont[1].trim()
        if (shouldStopOptionBeforeProseParagraph(optText, contLine)) break
        /** Blok alıntı sonraki sorunun («Yukarıdaki ifade…») girişi; şık e metnine yapışıyordu (Tezkire kitabı). */
        if (/^["“„«]/u.test(contLine)) break
        if (/^\s*[a-e](?:\.|\))\s*$/i.test(contLine)) break
        if (isNextOptionLine(`\n${contLine}`)) break
        if (
          /^(?:[1-9]|10)\.\s*$/i.test(contLine) ||
          (/\bÜnite\b/i.test(contLine) && /^(?:[1-9]|10)\./i.test(contLine))
        )
          break
        if (
          /^(?:[1-9]|10)\.\s+/i.test(contLine) &&
          isLikelyMcqQuestionStemAfterNumber(contLine) &&
          !/\bÜnite\b/i.test(contLine)
        )
          break
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
      const q: QuizQuestion = {
        number: qNum,
        stem,
        options: normalizeMangledMcqOptions(options),
      }
      if (srcPage !== undefined) q.sourcePage = srcPage
      questions.push(q)
    }
  }

  return questions
}

function parseAnswerChunk(chunk: string): Map<number, string> {
  const map = new Map<number, string>()
  /**
   * Küçük harf şık + `g` (türkçe «10. Aşağıdaki…» i/. için «10. A» sahte cevap olmasın).
   * «2. a» ile «2.a» / «5.e» gibi boşluksuz biçim (PDF.js, T. İşaret Dili).
   * Gövde metni chunk’ta kalınca aynı numaranın gerçek satırı «… Yanıtınız» ile gelir — onu yeğle.
   */
  const re = /(?:^|\n)\s*(\d+)\.\s*([a-e])\b/g
  let x: RegExpExecArray | null
  while ((x = re.exec(chunk)) !== null) {
    const n = Number(x[1])
    const letter = x[2]
    const after = chunk.slice(x.index + x[0].length, x.index + x[0].length + 130)
    const isPrintedKeyLine = /^\s*Yanıtınız/i.test(after)
    if (!map.has(n)) map.set(n, letter)
    else if (isPrintedKeyLine) map.set(n, letter)
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
  const re = /(\d+)\.\s*([a-e])\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(oneLine)) !== null) {
    const n = Number(m[1])
    if (hints.has(n)) continue
    const after = oneLine.slice(m.index + m[0].length)
    /**
     * Sınav gövdesindeki «2. a» gibi satırlar da bu kalıba girer; cevap anahtarı satırı ise
     * hemen ardından «Yanıtınız» ile gelir (kitap tipi yanıt listeleri).
     */
    if (!/^\s*Yanıtınız/i.test(after)) continue
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
    const n = Number(x[1])
    if (!map.has(n)) map.set(n, x[2].toLowerCase())
  }
  return map
}

type AnswerBundle = {
  answers: Map<number, string>
  hints: Map<number, string>
}

/** Yanıt bloğunun hangi «N. Ünite»ye ait olduğu (eşleştirme için) */
type TaggedAnswerBundle = {
  bundle: AnswerBundle
  /** `sliceQuestionBodies` sırasıyla aynı ünite numarası (1 tabanlı) */
  sourceUnitNo?: number
}

function unitNoFromÜniteTitle(title: string): number | undefined {
  const m = title.match(/^(\d+)\.\s*Ünite\b/i)
  return m ? Number(m[1]) : undefined
}

/** Kendimizi yanıt başlığının hemen öncesindeki «N. Ünite» satırı (kitap düzenine göre) */
function sourceUnitNoBeforeYanıtHeader(full: string, headerEndPos: number): number | undefined {
  const back = full.slice(Math.max(0, headerEndPos - 20_000), headerEndPos)
  let last: number | undefined
  const re = /\n\s*(\d+)\.\s*Ünite\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(back)) !== null) last = Number(m[1])
  return last
}

function hintMatchScoreForFirstQuestion(bundle: AnswerBundle, body: string): number {
  const stem = parseMcqBlock(body)[0]?.stem.toLowerCase() ?? ''
  const h1 = bundle.hints.get(1)
  if (!stem || !h1) return 0
  let sc = 0
  for (const w of h1
    .toLowerCase()
    .replace(/[“”"]/g, ' ')
    .split(/\s+/)
    .filter((x) => x.length > 4)) {
    if (stem.includes(w)) sc++
  }
  return sc
}

function assignAnswerBundlesByUnit(
  bodies: { unitTitle: string; body: string }[],
  tagged: TaggedAnswerBundle[],
): (AnswerBundle | undefined)[] {
  const byUnit = new Map<number, AnswerBundle>()
  const orphans: TaggedAnswerBundle[] = []

  for (const t of tagged) {
    if (t.sourceUnitNo !== undefined && t.sourceUnitNo >= 1) {
      if (!byUnit.has(t.sourceUnitNo)) byUnit.set(t.sourceUnitNo, t.bundle)
      else orphans.push(t)
    } else orphans.push(t)
  }

  for (const t of orphans) {
    let bestU = -1
    /** 0: yalnızca sc > 0 iken atama; eskiden 1 idi, tek kelime eşleşmesi (ör. «roman») hiçbir üniteye düşmüyordu. */
    let bestSc = 0
    for (let i = 0; i < bodies.length; i++) {
      const u = i + 1
      if (byUnit.has(u)) continue
      const sc = hintMatchScoreForFirstQuestion(t.bundle, bodies[i].body)
      if (sc > bestSc) {
        bestSc = sc
        bestU = u
      }
    }
    if (bestU > 0) byUnit.set(bestU, t.bundle)
  }

  return bodies.map((body, i) => {
    const u = unitNoFromÜniteTitle(body.unitTitle) ?? i + 1
    return byUnit.get(u)
  })
}

/**
 * Sayfa üstü «N. Ünite - … | 104» koşan başlığı; yanıt anahtarı 7→8 arasında gelince chunk erken kesiliyordu.
 */
function isRunningPageÜniteLine(line: string): boolean {
  const t = line.trim()
  return /\|/.test(t) && /\d/.test(t.slice(t.indexOf('|')))
}

/** Bu «Ünite» satırından hemen sonra 8–10 cevap satırları geliyorsa yanlış pozitif sınırdır. */
function yanıtAnahtarıContinues8910After(tail: string, unitLineStart: number): boolean {
  const win = tail.slice(unitLineStart, unitLineStart + 4000)
  const sıra = win.search(/\n\s*Sıra\s+Sizde\s+Yanıt\s+Anahtarı/i)
  const ans = win.search(/\n\s*(?:8|9|10)\.\s*[a-e]\b/i)
  if (ans < 0) return false
  return sıra < 0 || ans < sıra
}

/**
 * İlk cevap satırından sonra gerçek «bölüm sonu» ünite başlığını bul; koşan sayfa başlığını atla.
 */
function findUnitHeadingChunkEndAfterAnswers(tail: string, firstAnswerIdx: number): number {
  const re = /\n\s*\d+\.\s*Ünite\b/g
  re.lastIndex = Math.max(0, firstAnswerIdx)
  let m: RegExpExecArray | null
  while ((m = re.exec(tail)) !== null) {
    const idx = m.index
    const lineEnd = tail.indexOf('\n', idx + 1)
    const line = lineEnd < 0 ? tail.slice(idx) : tail.slice(idx, lineEnd)
    if (isRunningPageÜniteLine(line)) continue
    if (yanıtAnahtarıContinues8910After(tail, idx)) continue
    return idx
  }
  return -1
}

/**
 * Yanıt listesinden sonraki bölümlere kadar kes; PDF satır sonları `$` ile tutarsız olabildiğinden
 * başlık satırlarında `search` kullanıyoruz (chunk şişmeden önce durur).
 */
function findKendimiziYanıtChunkEnd(tail: string): number {
  /**
   * Sayfa üstündeki «\n1. Ünite - …» yanıt listesinden önce gelirse chunk’u başta kesip
   * cevap satırları parse edilemiyordu (answerSize: 0). Sadece ilk «n. harf» cevabından
   * *sonra* gelen Ünite satırını son sınır say.
   */
  const firstAnswerIdx = tail.search(/(?:^|\n)\s*\d+\.\s*[a-e]\b/i)
  let unitIdx = -1
  if (firstAnswerIdx >= 0) {
    unitIdx = findUnitHeadingChunkEndAfterAnswers(tail, firstAnswerIdx)
  } else {
    unitIdx = tail.search(/\n\s*\d+\.\s*Ünite\b/i)
  }

  const markers = [
    tail.search(/\n\s*Sıra\s+Sizde\s+Yanıt\s+Anahtarı/i),
    tail.search(/\n\s*Yararlanılan\s+ve\s+Başvurulabilecek\s+Kaynaklar/i),
    /** Sonraki ünite testi: «… Sınayalım» ama «Yanıt Anahtarı» değil */
    tail.search(/\n\s*Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım(?!\s+Yanıt)/i),
    unitIdx >= 0 ? unitIdx : -1,
  ]
  /** 0: boş kesim; negatif: bulunamadı */
  const found = markers.filter((i) => i > 0)
  if (found.length > 0) return Math.min(...found)
  return Math.min(tail.length, 80_000)
}

/** «Çağdaş Türk Romanı» / sayfa / doğrudan 1.a… kolofon yanıtı (Kendimizi başlığı olmayan üniteler) */
function sliceÇağdaşTürkRomanıColophonMaps(full: string): TaggedAnswerBundle[] {
  /** `\b` ASCII odaklıdır; «Romanı» sonundaki «ı» sonrası sınır eşleşmez, dal hep devre dışı kalıyordu. */
  if (!/Çağdaş\s+Türk\s+Romanı/i.test(full)) return []
  const out: TaggedAnswerBundle[] = []
  const re = /(?:^|\n)Çağdaş\s+Türk\s+Romanı\s*\n\s*\d+\s*\n/gi
  let hit: RegExpExecArray | null
  while ((hit = re.exec(full)) !== null) {
    const start = hit.index + hit[0].length
    const head = full.slice(start, start + 160)
    /**
     * Uzun «peek» içinde geçen «1. b» ile eşleşip work çöp metinle başlıyordu (cevap sayısı 0);
     * yanıt kolofonunda sayfa numarasından hemen sonra gelen ilk anlamlı satır «n. harf» olmalı.
     */
    /** `m` kullanma: «^» yalnızca kolofon kesiminin başında olmalı; satır içi «1. d» eşleşmez */
    if (!/^\s*\d+\.\s*[a-e]\b/i.test(head)) continue
    const work = full.slice(start)
    const end = findKendimiziYanıtChunkEnd(work)
    const chunk = work.slice(0, end)
    let answers = parseAnswerChunk(chunk)
    if (answers.size < 3) {
      const loose = parseAnswerChunkLoose(chunk)
      if (loose.size > answers.size) answers = loose
    }
    if (answers.size >= 3)
      out.push({ bundle: { answers, hints: parseAnswerHints(chunk) } })
  }
  return out
}

/** «Kendimizi Sınayalım Yanıt Anahtarı» blokları (+ ünite no + Sıra Sizde önek düzeltmesi) */
function sliceKendimiziAnswerMapsTagged(full: string): TaggedAnswerBundle[] {
  const out: TaggedAnswerBundle[] = []
  let hit: RegExpExecArray | null
  KENDIMIZI_YANIT_BASLIK.lastIndex = 0
  while ((hit = KENDIMIZI_YANIT_BASLIK.exec(full)) !== null) {
    const headerEnd = hit.index + hit[0].length
    const sourceUnit = sourceUnitNoBeforeYanıtHeader(full, headerEnd)

    const tail = full.slice(headerEnd)
    let work = tail
    const sıraSizdeIdx = tail.search(/\n\s*Sıra\s+Sizde\s+Yanıt\s+Anahtarı/i)
    const firstAnsIdx = tail.search(/(?:^|\n)\s*\d+\.\s*[a-e]\b/i)
    if (sıraSizdeIdx >= 0 && firstAnsIdx >= 0 && sıraSizdeIdx < firstAnsIdx) {
      if (sourceUnit === undefined) continue
      work = tail
        .slice(sıraSizdeIdx)
        .replace(/^\s*Sıra\s+Sizde\s+Yanıt\s+Anahtarı\s*\n*/i, '')
    }

    const head8 = work.slice(0, 8000)
    if (!/(?:^|\n)\s*1\.\s*[a-e]\b/i.test(head8)) {
      const back = tryKendimiziAnswerWorkFromBackward(full, hit.index, sourceUnit)
      const fwd = back ?? tryKendimiziAnswerWorkFromForwardTail(work, sourceUnit)
      if (!fwd) continue
      work = fwd
    }

    if (!/(?:^|\n)\s*1\.\s*[a-e]\b/i.test(work.slice(0, 8000))) continue

    const end = findKendimiziYanıtChunkEnd(work)
    const chunk = work.slice(0, end)
    let answers = parseAnswerChunk(chunk)
    if (answers.size < 3) {
      const loose = parseAnswerChunkLoose(chunk)
      if (loose.size > answers.size) answers = loose
    }
    if (answers.size >= 3)
      out.push({
        bundle: { answers, hints: parseAnswerHints(chunk) },
        sourceUnitNo: sourceUnit,
      })
  }
  return out
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
  const answerMaps: (AnswerBundle | undefined)[] = usedFallback
    ? sliceLooseYanıtAnswerMaps(fullText)
    : assignAnswerBundlesByUnit(bodies, [
        ...sliceÇağdaşTürkRomanıColophonMaps(fullText),
        ...sliceKendimiziAnswerMapsTagged(fullText),
      ])

  const sections = bodies.map((b, idx) => {
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

  return sections
}

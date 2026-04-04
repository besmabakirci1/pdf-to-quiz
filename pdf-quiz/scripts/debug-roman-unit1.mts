import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Downloads/AOFGAMZE/ÇAĞDAŞ TÜRK ROMANI.pdf'

const data = new Uint8Array(fs.readFileSync(path))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
const parts: string[] = []
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const content = await page.getTextContent()
  parts.push(`<<PAGE:${i}>>`)
  parts.push(
    content.items.map((it) => ('str' in it ? it.str : '')).join('\n'),
  )
}
const full = sanitizePdfExtractedText(parts.join('\n'))
const sections = buildQuizzesFromPdfText(full)
const s0 = sections[0]
console.log('sections', sections.length)
sections.forEach((s, i) => {
  const q1 = s.questions[0]
  console.log(
    i,
    s.unitTitle.slice(0, 52),
    'Q1 key:',
    q1?.correctKey,
  )
})
console.log('UNIT 0:', s0?.unitTitle)
const q1 = s0?.questions[0]
console.log('Q1 correctKey (parsed):', q1?.correctKey)
console.log('Q1 stem:', q1?.stem?.slice(0, 280))
console.log('Q1 options:', q1?.options?.map((o) => `${o.key}:${o.text.slice(0, 60)}`).join(' | '))

/** Yakındaki yanıt anahtarı ham metni: ilk Kendimizi Yanıt Anahtarı blokundan 2500 karakter */
const yRe =
  /Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı/gi
let m: RegExpExecArray | null
yRe.lastIndex = 0
let first = -1
while ((m = yRe.exec(full)) !== null) {
  first = m.index + m[0].length
  break
}
const yBas =
  /Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı/gi
let hit: RegExpExecArray | null
let idx = 0
yBas.lastIndex = 0
console.log('\n--- All Yanıt Anahtarı header positions ---')
while ((hit = yBas.exec(full)) !== null) {
  idx++
  const tail = full.slice(hit.index + hit[0].length)
  const head = tail.slice(0, 400)
  const has1 = /(?:^|\n)\s*1\.\s*[a-e]\b/i.test(tail.slice(0, 8000))
  console.log(idx, 'pos', hit.index, 'has1.a-e in head?', has1)
  console.log('  head sample:', head.replace(/\s+/g, ' ').slice(0, 120))
}

if (first >= 0) {
  const chunk = full.slice(first, first + 2500).replace(/\u008d/g, 'ı')
  console.log('\n--- First answer block preview (after header) ---\n')
  console.log(chunk.slice(0, 1800))
}

const u1needle = 'Tarihî Roman Kavramı'
const u1i = full.indexOf(u1needle)
let scan = u1i >= 0 ? u1i : 0
const yAfterU1 = full.indexOf('Kendimizi Sınayalım Yanıt Anahtarı', scan)
console.log('\n--- First Kendimizi Yanıt after unit title needle ---')
console.log('pos', yAfterU1)
if (yAfterU1 >= 0) {
  console.log(full.slice(yAfterU1, yAfterU1 + 1400).replace(/\u008d/g, 'ı'))
}

/** pos 94456 = hit #10: içerikte 1.a var mı, kaç karakter sonra? */
const p10 = 94456
const h10 =
  'Kendimizi Sınayalım Yanıt Anahtarı'.length + p10
const t10 = full.slice(
  p10 + 'Kendimizi Sınayalım Yanıt Anahtarı'.length,
  p10 + 50_000,
)
const mAns = t10.match(/(?:^|\n)\s*1\.\s*[a-e]\b/im)
console.log('\n--- hit10 tail: first 1.a-e offset', mAns ? mAns.index : -1)
console.log(t10.slice(0, 2500).replace(/\u008d/g, 'ı'))

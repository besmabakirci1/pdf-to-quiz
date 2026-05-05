import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Desktop/pdf-to-quiz/pdf-quiz/AOFGAMZE/TÜRK İŞARET DİLİ.pdf'

const data = new Uint8Array(fs.readFileSync(path))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
const parts: string[] = []
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const c = await page.getTextContent()
  parts.push(`<<PAGE:${i}>>`)
  parts.push(c.items.map((it) => ('str' in it ? it.str : '')).join('\n'))
}
const full = sanitizePdfExtractedText(parts.join('\n'))
const qs = buildQuizzesFromPdfText(full)
qs.forEach((s, i) => {
  const withKey = s.questions.filter((q) => q.correctKey).length
  console.log(
    `${i + 1}. ${s.unitTitle.slice(0, 60)} — ${s.questions.length} soru, ${withKey} cevap anahtarı`,
  )
})

const u2 = qs[1]
console.log('\n== Ünite 2 detay ==')
u2?.questions.forEach((q) =>
  console.log(`Q${q.number} key=${q.correctKey ?? '?'} | ${q.stem.slice(0, 60)}`),
)

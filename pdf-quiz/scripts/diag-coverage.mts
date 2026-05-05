import fs from 'node:fs'
import path from 'node:path'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const ROOTS = [
  '/Users/basmabakirci/Desktop/pdf-to-quiz/pdf-quiz/AOFGAMZE',
  '/Users/basmabakirci/Desktop/pdf-to-quiz/pdf-quiz/AOFGAMZE/girdi',
  '/Users/basmabakirci/Desktop/pdf-to-quiz/pdf-quiz/AOFGAMZE/test ettim',
]

const pdfs: string[] = []
for (const r of ROOTS) {
  if (!fs.existsSync(r)) continue
  for (const f of fs.readdirSync(r)) {
    if (f.toLowerCase().endsWith('.pdf')) pdfs.push(path.join(r, f))
  }
}

let totalUnits = 0
let unitsWithNoKey = 0
let unitsLowQ = 0

for (const p of pdfs) {
  const data = new Uint8Array(fs.readFileSync(p))
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
  console.log(`\n#### ${path.basename(p)} (${qs.length} bölüm)`)
  qs.forEach((s, i) => {
    const total = s.questions.length
    const keyed = s.questions.filter((q) => q.correctKey).length
    totalUnits++
    if (keyed === 0) unitsWithNoKey++
    if (total < 8) unitsLowQ++
    const flag =
      keyed === total && total >= 8
        ? 'OK'
        : keyed === 0
          ? 'NO-KEY'
          : total < 8
            ? 'FEW-Q'
            : 'PARTIAL'
    console.log(
      `  ${i + 1}. ${flag.padEnd(8)} ${total} soru / ${keyed} anahtar — ${s.unitTitle.slice(0, 70)}`,
    )
  })
}

console.log(
  `\n=== Toplam: ${totalUnits} ünite | anahtarsız: ${unitsWithNoKey} | düşük soru: ${unitsLowQ} ===`,
)

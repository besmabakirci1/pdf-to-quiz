/* Tüm PDF'lerde parser çıkışındaki ünite başlıklarını listele */
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
  const sections = buildQuizzesFromPdfText(full)
  console.log(`\n# ${path.basename(p)}: ${sections.length} bölüm`)
  for (const s of sections) {
    console.log(`  • ${s.unitTitle}  (${s.questions.length} soru)`)
  }
}

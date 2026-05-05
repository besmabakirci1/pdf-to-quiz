/* Hangi sorular `questionNeedsPageFigure` tarafından figür gerektirir olarak işaretleniyor? */
import fs from 'node:fs'
import path from 'node:path'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import {
  buildQuizzesFromPdfText,
  questionNeedsPageFigure,
} from '../src/lib/parseKendimizi.ts'

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
  let total = 0
  let triggers = 0
  const examples: string[] = []
  for (const s of sections) {
    for (const q of s.questions) {
      total++
      if (questionNeedsPageFigure(q.stem)) {
        triggers++
        if (examples.length < 5) examples.push(`Q${q.number}: ${q.stem.slice(0, 80)}`)
      }
    }
  }
  console.log(
    `\n# ${path.basename(p)}: ${triggers}/${total} soru figür istiyor`,
  )
  for (const ex of examples) console.log('  •', ex)
}

import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Desktop/pdf-to-quiz/pdf-quiz/AOFGAMZE/TÜRK İŞARET DİLİ.pdf'
const data = new Uint8Array(fs.readFileSync(path))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
console.log('numPages:', doc.numPages)
for (const p of [64, 65, 66, 67, 68, 69]) {
  if (p > doc.numPages) continue
  const page = await doc.getPage(p)
  const c = await page.getTextContent()
  const text = c.items.map((it) => ('str' in it ? it.str : '')).join(' | ')
  const op = await page.getOperatorList()
  const imgOps = op.fnArray.filter(
    (k) => k === pdfjs.OPS.paintImageXObject || k === pdfjs.OPS.paintInlineImageXObject,
  ).length
  console.log(`\n=== page ${p} (textLen=${text.length}, imageOps=${imgOps}) ===`)
  console.log(text.slice(0, 1500))
}

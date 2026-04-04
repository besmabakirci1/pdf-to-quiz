import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Downloads/AOFGAMZE/ÇAĞDAŞ TÜRK ROMANI.pdf'

const data = new Uint8Array(fs.readFileSync(path))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
const parts: string[] = []
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const content = await page.getTextContent()
  parts.push(content.items.map((it) => ('str' in it ? it.str : '')).join('\n'))
}
const full = sanitizePdfExtractedText(parts.join('\n'))
const needle = 'tarihî roman ve yazarı'
const ix = full.indexOf(needle)
console.log('stem idx', ix)
if (ix >= 0) console.log(full.slice(ix - 80, ix + 350))

/** Kendimizi yanıt bloklarında "1." ile başlayan satırlar + sonraki 2 satır */
const yRe =
  /Kendimizi\s+Sınayalım\s+Yanıt\s+Anahtarı[\s\S]{0,1200}?(?=(?:\n\s*Sıra\s+Sizde|Kendimizi\s+Sınayalım(?!\s+Yanıt)|$))/gi
let m: RegExpExecArray | null
let n = 0
while ((m = yRe.exec(full)) !== null && n < 15) {
  n++
  const block = m[0].replace(/\s+/g, ' ').slice(0, 700)
  console.log('\n--- block', n, 'pos', m.index, '---')
  console.log(block)
}

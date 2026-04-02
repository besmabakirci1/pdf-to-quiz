import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

function sanitize(s: string) {
  return s
    .replace(/\u001d/g, 'i')
    .replace(/\u001f/g, 'i')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001c\u001e\u007f]/g, '')
}

const data = new Uint8Array(
  fs.readFileSync('/Users/basmabakirci/Downloads/AOFGAMZE/TÜRK TİYATROSU.pdf'),
)
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
const parts: string[] = []
for (let i = 1; i <= doc.numPages; i++) {
  const p = await doc.getPage(i)
  const c = await p.getTextContent()
  parts.push(c.items.map((it) => ('str' in it ? it.str : '')).join('\n'))
}
const full = sanitize(parts.join('\n\n'))
const quizzes = buildQuizzesFromPdfText(full)
const b = quizzes[0].bodyRaw
const i = b.indexOf('\n4.')
console.log(b.slice(i - 120, i + 400))

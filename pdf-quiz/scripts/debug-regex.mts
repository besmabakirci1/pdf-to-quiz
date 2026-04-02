import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { buildQuizzesFromPdfText, parseMcqBlock } from '../src/lib/parseKendimizi.ts'

function sanitizePdfExtractedText(s: string): string {
  return s
    .replace(/\u001d/g, 'i')
    .replace(/\u001f/g, 'i')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001c\u001e\u007f]/g, '')
}

const path = '/Users/basmabakirci/Downloads/AOFGAMZE/TÜRK TİYATROSU.pdf'
const data = new Uint8Array(fs.readFileSync(path))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
const parts: string[] = []
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const content = await page.getTextContent()
  parts.push(content.items.map((it) => ('str' in it ? it.str : '')).join('\n'))
}
const full = sanitizePdfExtractedText(parts.join('\n\n'))

const quizzes = buildQuizzesFromPdfText(full)
const body = quizzes[0]?.bodyRaw ?? ''
const idx = body.search(/\na\./i)
console.log('idx', idx)
console.log('around a', JSON.stringify(body.slice(Math.max(0, idx - 8), idx + 12)))
console.log('codes', [...body.slice(idx, idx + 6)].map((c) => c.codePointAt(0)))
const m = body.match(/^(\d+)\.\s+([\s\S]*?)(?=\n\s*[a-e]\.\s+)/i)
console.log('regex match', !!m)
console.log('parseMcqBlock', parseMcqBlock(body).length)

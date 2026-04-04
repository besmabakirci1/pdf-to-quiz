import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Library/Application Support/Cursor/User/workspaceStorage/6f7087bd6dd45c80896e232a5b67d134/pdfs/9a151704-6000-474b-98e2-b36edf1bd9ba/TÜRK TİYATROSU.pdf'

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
const u1 = qs[0]
console.log('U1 questions:', u1?.questions?.length)
for (let i = 0; i < Math.min(10, u1?.questions?.length ?? 0); i++) {
  const q = u1!.questions[i]!
  console.log(i + 1, 'correctKey=', q.correctKey ?? '—', '|', q.stem.slice(0, 55))
}

const yRe =
  /Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı/gi
yRe.lastIndex = 0
const hit = yRe.exec(full)
if (hit) {
  const tail = full.slice(hit.index + hit[0].length)
  const i7 = tail.search(/\n\s*7\.\s*[a-e]\b/i)
  const i8 = tail.search(/\n\s*8\.\s*[a-e]\b/i)
  const iUnit = tail.search(/\n\s*1\.\s*Ünite\b/i)
  console.log('\nAfter first yanıt header:')
  console.log('idx 7. answer', i7, 'idx 8. answer', i8, 'idx 1.Ünite', iUnit)
  console.log('\nSnippet from 6.. to 9.. :\n', tail.slice(Math.max(0, i7 - 100), i8 + 400))
}

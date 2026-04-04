import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path = process.argv[2] ?? ''
if (!path || !fs.existsSync(path)) {
  console.error('Usage: npx tsx scripts/diag-tezkire-q7-8.mts <pdf>')
  process.exit(1)
}

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

/** Hangi ünite “tezkire” / Mecalisü geçiyorsa */
let idx = qs.findIndex((s) =>
  /tezkire|şair|Meşair/i.test(s.unitTitle + s.bodyRaw.slice(0, 500)),
)
if (idx < 0) idx = 0
const sec = qs[idx]!
console.log('Section:', sec.unitTitle, 'n=', sec.questions.length)

for (const n of [6, 7, 8, 9]) {
  const q = sec.questions[n - 1]
  if (!q) continue
  console.log('\n--- Q', n, '---')
  console.log('stem:', q.stem.slice(0, 200))
  q.options.forEach((o) => console.log(o.key, o.text.slice(0, 120) + (o.text.length > 120 ? '…' : '')))
}

const rawI = full.search(/\n\s*7\.\s+[^\n]*tezkire[^\n]*yazarı/i)
console.log('\n--- RAW ~Q7 ---\n', full.slice(Math.max(0, rawI - 80), rawI + 2200))

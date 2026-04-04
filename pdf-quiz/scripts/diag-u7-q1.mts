import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path = process.argv[2] ?? ''
if (!path || !fs.existsSync(path)) {
  console.error('Usage: npx tsx scripts/diag-u7-q1.mts <path-to.pdf>')
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
const u7 = qs[6]
const q1 = u7?.questions?.[0]
console.log('U7 title:', u7?.unitTitle)
console.log('Q1 correctKey:', q1?.correctKey)
console.log('Q1 stem:', q1?.stem)
q1?.options?.forEach((o) => console.log(o.key, o.text))

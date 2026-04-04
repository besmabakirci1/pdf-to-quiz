import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Downloads/AOFGAMZE/ÇAĞDAŞ TÜRK YAZI DİLLERİ II.pdf'

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
const u4 = qs[3]
console.log('Unit:', u4?.unitTitle)
console.log('n questions:', u4?.questions?.length)
const q8 = u4?.questions?.[7]
const q9 = u4?.questions?.[8]
console.log('\nQ8 stem:', q8?.stem)
console.log('Q8 e:', q8?.options?.find((o) => o.key === 'e')?.text)
console.log('\nQ9 stem:', q9?.stem)
console.log('Q9 options:', q9?.options?.map((o) => `${o.key}:${o.text.slice(0, 40)}`).join(' | '))

const i = full.search(/\n\s*8\.\s+.*Tukay/i)
console.log('\n--- RAW snippet ---\n', full.slice(Math.max(0, i - 80), i + 1200))

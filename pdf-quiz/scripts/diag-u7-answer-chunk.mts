import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'

const path = process.argv[2] ?? ''
if (!path || !fs.existsSync(path)) {
  console.error('Usage: npx tsx scripts/diag-u7-answer-chunk.mts <path-to.pdf>')
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

const re =
  /Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı/gi
re.lastIndex = 0
let m: RegExpExecArray | null
let n = 0
while ((m = re.exec(full)) !== null) {
  const back = full.slice(Math.max(0, m.index - 3500), m.index)
  const hasU7 = /7\.\s*Ünite[^\n]*Gelenekçi/i.test(back)
  if (!hasU7) continue
  const chunk = full.slice(m.index, m.index + 2200)
  console.log('--- Chunk after U7 yanıt header (pos', m.index, ') ---')
  console.log(chunk.replace(/\n{3,}/g, '\n\n'))
  n++
}
if (n === 0) console.log('No U7-tagged yanıt chunk found (heuristic)')

import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path = '/Users/basmabakirci/Downloads/AOFGAMZE/DİJİTAL TOPLUM TEKNOLOJİLERİ.pdf'
const data = new Uint8Array(fs.readFileSync(path))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
const parts: string[] = []
for (let i = 1; i <= doc.numPages; i++) {
  const p = await doc.getPage(i)
  const c = await p.getTextContent()
  parts.push(c.items.map((it) => ('str' in it ? it.str : '')).join('\n'))
}
const full = sanitizePdfExtractedText(parts.join('\n\n'))
console.log('Kendimizi count', (full.match(/Kendimizi/gi) || []).length)
console.log('yanıt anahtarı', (full.match(/yanıt anahtarı/gi) || []).length)
const low = full.toLowerCase()
let pos = 0
let n = 0
while (n < 3) {
  const y = low.indexOf('yanıt anahtarı', pos)
  if (y < 0) break
  const lineStart = full.lastIndexOf('\n', y - 1) + 1
  const lineEnd = full.indexOf('\n', y)
  const line =
    lineEnd > 0 ? full.slice(lineStart, lineEnd) : full.slice(lineStart, y + 24)
  const dots = (line.match(/\./g) || []).length
  const chunkStart = Math.max(0, y - 22_000)
  const raw = full.slice(chunkStart, y).trim()
  const qDots = (line.match(/\.{6,}/) || []).length
  console.log('--- hit', n, 'dots in line', dots, 'toc?', !!qDots, 'rawLen', raw.length)
  console.log('line:', JSON.stringify(line.slice(0, 120)))
  pos = y + 14
  n++
}

const qs = buildQuizzesFromPdfText(full)
console.log(
  'build',
  qs.length,
  'total q',
  qs.reduce((a, s) => a + s.questions.length, 0),
)

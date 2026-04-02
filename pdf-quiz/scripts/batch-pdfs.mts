import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'

async function extractFull(path: string) {
  const data = new Uint8Array(fs.readFileSync(path))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i)
    const c = await p.getTextContent()
    parts.push(c.items.map((it) => ('str' in it ? it.str : '')).join('\n'))
  }
  return sanitizePdfExtractedText(parts.join('\n\n'))
}

const dir = '/Users/basmabakirci/Downloads/AOFGAMZE'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'))
for (const f of files.sort()) {
  const path = `${dir}/${f}`
  const full = await extractFull(path)
  const qs = buildQuizzesFromPdfText(full)
  const total = qs.reduce((a, s) => a + s.questions.length, 0)
  const empty = qs.filter((s) => s.questions.length === 0).length
  console.log(`${f}\tsections:${qs.length}\tsorular:${total}\tboş:${empty}`)
}

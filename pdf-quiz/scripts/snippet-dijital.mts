import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'

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
const needle = 'Bilgisayar ağları büyüklüklerine'
const idx = full.indexOf(needle)
console.log('idx', idx)
console.log(JSON.stringify(full.slice(idx - 40, idx + 200)))

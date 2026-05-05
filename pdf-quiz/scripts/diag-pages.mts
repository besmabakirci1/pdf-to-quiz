/* npx tsx scripts/diag-pages.mts "<pdf>" <fromPage> <toPage> */
import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const path = process.argv[2]
const from = Number(process.argv[3] ?? 1)
const to = Number(process.argv[4] ?? from)
if (!path) {
  console.error('Usage: <pdf> <from> <to>')
  process.exit(1)
}

const data = new Uint8Array(fs.readFileSync(path))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
for (let p = from; p <= to && p <= doc.numPages; p++) {
  const page = await doc.getPage(p)
  const c = await page.getTextContent()
  const text = c.items.map((it) => ('str' in it ? it.str : '')).join(' | ')
  console.log(`\n=== PAGE ${p} (${text.length} chars) ===`)
  console.log(text.slice(0, 1800))
}

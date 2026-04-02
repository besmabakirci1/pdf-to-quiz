import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
)

const pdfPath = process.argv[2] ?? ''
const pages = (process.argv[3] ?? '26,27,28,29').split(',').map(Number)
if (!pdfPath) {
  console.error('Usage: dump-pdfjs-pages.mts <pdf> [pages]')
  process.exit(1)
}

async function main() {
const data = new Uint8Array(fs.readFileSync(pdfPath))
const doc = await pdfjs.getDocument({ data }).promise
if (process.env.FIND_KENDIMIZI === '1') {
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i)
    const c = await p.getTextContent()
    const line = c.items.map((it) => ('str' in it ? it.str : '')).join('\n')
    if (/Kendimizi\s+Sınayalım/i.test(line)) console.log('PAGE', i)
  }
  return
}
if (process.env.FIND_STEM === '1') {
  const needle = process.argv[4] ?? 'İşaret dili ve işaret'
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i)
    const c = await p.getTextContent()
    const line = c.items.map((it) => ('str' in it ? it.str : '')).join('\n')
    if (line.includes(needle)) console.log('PAGE', i)
  }
  return
}
for (const i of pages) {
  const p = await doc.getPage(i)
  const c = await p.getTextContent()
  const line = c.items.map((it) => ('str' in it ? it.str : '')).join('\n')
  console.log(`\n--- PAGE ${i} ---\n`)
  console.log(line)
}
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

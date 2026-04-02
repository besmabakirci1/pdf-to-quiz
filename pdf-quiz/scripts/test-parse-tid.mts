import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const require = createRequire(import.meta.url)
pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
)

const pdfPath =
  process.argv[2] ??
  '/Users/basmabakirci/Downloads/AOFGAMZE/TÜRK İŞARET DİLİ.pdf'

const data = new Uint8Array(fs.readFileSync(pdfPath))
const doc = await pdfjs.getDocument({ data }).promise
const parts: string[] = []
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const content = await page.getTextContent()
  const line = content.items
    .map((it) => ('str' in it ? it.str : ''))
    .join('\n')
  parts.push(line)
}
const full = sanitizePdfExtractedText(parts.join('\n\n'))
const quizzes = buildQuizzesFromPdfText(full)
const first = quizzes[0]
console.log('sections', quizzes.length)
console.log('first unitTitle:', first?.unitTitle)
console.log('first q count:', first?.questions.length)
console.log(
  'first q numbers:',
  first?.questions.map((q) => q.number).join(','),
)
if (first?.questions.length)
  console.log('last stem snippet:', first.questions.at(-1)?.stem.slice(0, 80))

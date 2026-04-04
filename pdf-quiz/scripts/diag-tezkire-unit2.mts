import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Library/Application Support/Cursor/User/workspaceStorage/6f7087bd6dd45c80896e232a5b67d134/pdfs/b3407660-2e9b-4005-a042-4e4e5adc5121/ESKİ TÜRK EDEBİYATININ KAYNAKLARINDAN ŞAİR TEZKİRELERİ.pdf'

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

const u2 = qs[1]
console.log('U2 title:', u2?.unitTitle)
console.log('n questions:', u2?.questions?.length)
u2?.questions?.forEach((q, i) =>
  console.log(i + 1, q.number, q.stem.slice(0, 70)),
)

// locate 2. ünite kendimizi in raw
const k = /Kend(?:imizi|imzi)\s+S[ıi]nayalım(?!\s+Yanıt)/gi
let hit: RegExpExecArray | null
let n = 0
while ((hit = k.exec(full)) !== null) {
  const back = full.slice(Math.max(0, hit.index - 800), hit.index)
  if (!/2\.\s*Ünite[^\n]*16/i.test(back) && !/16\.\s*Yüzyıl[^\n]*Şair/i.test(back)) continue
  console.log('\n--- Kendimizi pos', hit.index, '---')
  console.log(full.slice(hit.index, hit.index + 3800))
  n++
  break
}

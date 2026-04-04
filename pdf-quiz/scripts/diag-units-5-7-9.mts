import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Downloads/AOFGAMZE/ÇAĞDAŞ TÜRK ROMANI.pdf'

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

for (const idx of [4, 6, 8]) {
  const s = qs[idx]
  console.log(
    `\n=== Ünite ${idx + 1} (${s?.unitTitle?.slice(0, 52)}…) soru: ${s?.questions?.length} ===`,
  )
  s?.questions?.forEach((q, i) =>
    console.log(
      `${i + 1}. key=${q.correctKey ?? '?'} | ${q.stem.slice(0, 72)}…`,
    ),
  )
}

const u7 = qs[6]
const q10 = u7?.questions?.[9]
console.log('\n--- U7 Q10 ---')
console.log('correctKey:', q10?.correctKey)
console.log('stem:', q10?.stem)
q10?.options?.forEach((o) => console.log(o.key, o.text))

const u9 = qs[8]
const q9 = u9?.questions?.[8]
console.log('\n--- U9 Q9 ---')
console.log('stem:', q9?.stem)
q9?.options?.forEach((o) => console.log(o.key, o.text?.slice(0, 100)))

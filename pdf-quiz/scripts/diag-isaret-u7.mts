/**
 * Türk İşaret Dili PDF — ünite listesi, özellikle 7. ünite soru/cevap sayısı.
 * Kullanım: npx tsx scripts/diag-isaret-u7.mts "/path/TÜRK İŞARET DİLİ.pdf"
 */
import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Downloads/AOFGAMZE/TÜRK İŞARET DİLİ.pdf'

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

console.log('Total sections:', qs.length)
qs.forEach((s, i) => {
  const w = s.questions.filter((q) => q.correctKey).length
  console.log(
    i + 1,
    '|',
    s.unitTitle.slice(0, 55),
    '| Q',
    s.questions.length,
    '| keys',
    w,
  )
})

const u7 = qs.find(
  (s) =>
    /7\.\s*Ünite/i.test(s.unitTitle) && /Sağlıklı\s+Yaşam/i.test(s.unitTitle),
)
if (u7) {
  console.log('\n--- U7 questions (number, key, stem 60ch) ---')
  u7.questions.forEach((q) => {
    console.log(q.number, q.correctKey ?? '-', q.stem.slice(0, 60))
  })
  console.log('\n--- U7 bodyRaw first 3500 ---')
  console.log(u7.bodyRaw.slice(0, 3500))
}

const gaps = qs.filter((s) => s.questions.some((q) => !q.correctKey))
if (gaps.length) {
  console.log('\n--- Units with missing answer keys ---')
  for (const s of gaps) {
    const miss = s.questions.filter((q) => !q.correctKey).map((q) => q.number)
    console.log(s.unitTitle.slice(0, 60), 'missing #', miss.join(','))
  }
}

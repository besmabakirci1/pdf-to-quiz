/* Tek bir ünitenin parser görünümünü ve yakın yanıt başlıklarını çıkarır.
 * Kullanım: npx tsx scripts/diag-unit-detail.mts "<pdf>" <unitNumber>
 */
import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path = process.argv[2]
const u = Number(process.argv[3])
if (!path || !u) {
  console.error('Usage: <pdf> <unitNumber>')
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

const qs = buildQuizzesFromPdfText(full)
const sec = qs[u - 1]
console.log(`### ${path.split('/').pop()} – Ünite ${u}`)
console.log('Parser title:', sec?.unitTitle)
console.log('Soru sayısı:', sec?.questions.length, '| anahtar:', sec?.questions.filter((q) => q.correctKey).length)
sec?.questions.forEach((q) =>
  console.log(`Q${q.number} key=${q.correctKey ?? '?'} | ${q.stem.slice(0, 70)}`),
)

// Locate the Kendimizi Sınayalım header for this unit, and its Yanıt Anahtarı pair
const titlePat = new RegExp(`\\n\\s*${u}\\.\\s*Ünite[^\\n]*`, 'i')
const tIdx = full.search(titlePat)
console.log('\n[diag] unit title pos:', tIdx)
if (tIdx < 0) process.exit(0)
const window = full.slice(tIdx, tIdx + 200_000)

const ks = [...window.matchAll(/Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım(?!\s+Yanıt)/gi)]
const ya = [...window.matchAll(/Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı/gi)]
const next = [...window.matchAll(new RegExp(`\\n\\s*${u + 1}\\.\\s*Ünite\\b`, 'gi'))]
console.log('Kendimizi Sınayalım hits (rel):', ks.slice(0, 4).map((m) => m.index))
console.log('Yanıt Anahtarı hits (rel):', ya.slice(0, 6).map((m) => m.index))
console.log('Next-unit title (rel):', next.slice(0, 3).map((m) => m.index))

// Show nearby snippets for first 1-2 yanıt headers (back + ahead)
for (const ym of ya.slice(0, 3)) {
  const off = ym.index ?? 0
  console.log(`\n=== yanıt header @rel ${off} (BACK 4000) ===`)
  console.log(window.slice(Math.max(0, off - 4000), off))
  console.log(`\n=== yanıt header @rel ${off} (AHEAD 1500) ===`)
  console.log(window.slice(off, off + 1500))
}

// Also locate ALL kendimizi (without yanıt) headers and which unit-titled regions they fall in
console.log('\n[diag] all Kendimizi Sınayalım (without Yanıt) globally; show first 5 with surrounding 200 chars:')
const ks2 = [...full.matchAll(/Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım(?!\s+Yanıt)/gi)]
ks2.slice(0, 30).forEach((m) => {
  const start = m.index ?? 0
  const back = full.slice(Math.max(0, start - 250), start).replace(/\s+/g, ' ').slice(-250)
  const ahead = full.slice(start, start + 80).replace(/\s+/g, ' ')
  console.log(`abs=${start}`.padEnd(11), 'back:', back, '| ahead:', ahead)
})

// Locate ALL Yanıt Anahtarı globally
const ya2 = [...full.matchAll(/Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı/gi)]
console.log('\n[diag] all Yanıt Anahtarı abs positions:', ya2.map((m) => m.index))

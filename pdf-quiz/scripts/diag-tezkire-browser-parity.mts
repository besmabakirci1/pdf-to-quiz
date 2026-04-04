/**
 * Tarayıcı (pdfQuizBundle) vs betik (useSystemFonts) metin farkı — soru/cevap sayıları.
 * Kullanım: npx tsx scripts/diag-tezkire-browser-parity.mts "/path/to/tezkire.pdf"
 */
import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { buildQuizzesFromPdfText } from '../src/lib/parseKendimizi.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Downloads/AOFGAMZE/ESKİ TÜRK EDEBİYATININ KAYNAKLARINDAN ŞAİR TEZKİRELERİ.pdf'

async function extract(useSystemFonts: boolean) {
  const data = new Uint8Array(fs.readFileSync(path))
  const doc = await pdfjs.getDocument({ data, useSystemFonts }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const c = await page.getTextContent()
    parts.push(`<<PAGE:${i}>>`)
    parts.push(c.items.map((it) => ('str' in it ? it.str : '')).join('\n'))
  }
  return sanitizePdfExtractedText(parts.join('\n'))
}

for (const sys of [false, true]) {
  const full = await extract(sys)
  const qs = buildQuizzesFromPdfText(full)
  console.log('\n=== useSystemFonts:', sys, '(false = browser parity) ===')
  qs.forEach((s, i) => {
    const w = s.questions.filter((q) => q.correctKey).length
    console.log(
      i + 1,
      s.unitTitle.slice(0, 52),
      '| Q',
      s.questions.length,
      '| keys',
      w,
    )
  })
}

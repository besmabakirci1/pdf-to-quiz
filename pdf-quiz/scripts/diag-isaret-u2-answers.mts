import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Desktop/pdf-to-quiz/pdf-quiz/AOFGAMZE/TÜRK İŞARET DİLİ.pdf'
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

const re =
  /Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı/gi
re.lastIndex = 0
let m: RegExpExecArray | null
while ((m = re.exec(full)) !== null) {
  const back = full.slice(Math.max(0, m.index - 6000), m.index)
  const lastUnitMatches = [...back.matchAll(/\d+\.\s*Ünite\b[^\n]*/g)]
  const lastUnit = lastUnitMatches[lastUnitMatches.length - 1]?.[0] ?? null
  const ahead = full.slice(m.index, m.index + 100).replace(/\s+/g, ' ')
  const looksTOC = /\.{6,}/.test(full.slice(m.index - 200, m.index + 200))
  console.log(
    `pos=${m.index}`.padEnd(11),
    'TOC?',
    looksTOC ? 'Y' : 'N',
    'lastUnit:',
    lastUnit?.slice(0, 50),
    '| ahead:',
    ahead.slice(0, 80),
  )
}

// Search whole text for "Türkçenin tarihsel" hint (review topic for U2 Q1)
const hintRe = /Türkçenin\s+tarihsel/gi
let hm: RegExpExecArray | null
hintRe.lastIndex = 0
while ((hm = hintRe.exec(full)) !== null) {
  console.log('hint pos', hm.index, '...', full.slice(hm.index - 50, hm.index + 200).replace(/\s+/g, ' '))
}

// Look for U2-typical answer key pattern anywhere in document: "1. <letter>\n\nYanıtınız yanlış ise"
const u2Title = /Türk\s+İşaret\s+Dili\s+Tarihi/gi
let tm: RegExpExecArray | null
const positions: number[] = []
while ((tm = u2Title.exec(full)) !== null) positions.push(tm.index)
console.log('\nALL Türk İşaret Dili Tarihi positions:', positions)

// page where U2 title appears: scan U2 page for nearby answer rows like "1. b" "2. e"
for (const p of positions) {
  const win = full.slice(Math.max(0, p - 200), p + 4000)
  if (/Yanıtınız\s+yanlış\s+ise/i.test(win)) {
    console.log(
      `\n--- POS ${p}: window has Yanıtınız (likely answers) ---\n`,
      win.slice(0, 4000),
    )
  }
}

import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { normalizeQuestionBlockLayout, parseMcqBlock } from '../src/lib/parseKendimizi.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Downloads/AOFGAMZE/ÇAĞDAŞ TÜRK ROMANI.pdf'

const yRe =
  /\n\s*Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı(?=\s|$)/i
const oRe = /\n\s*Okuma\s+Parçası(?=\s|$)/i
const KENDIMIZI_QUIZ_HEADER =
  /Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım(?!\s+Yanıt)/gi

function findUnitTitleBefore(full: string, kendimiziIndex: number): string {
  const back = full.slice(Math.max(0, kendimiziIndex - 4500), kendimiziIndex)
  const lines = back
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (/^\d+\.\s*Ünite/i.test(line)) return line
    if (/ünite/i.test(line) && /^[\dİIivx]+\./i.test(line)) return line
    if (/^BÖLÜM\s+\d+/i.test(line)) return line
  }
  return 'Ünite'
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

KENDIMIZI_QUIZ_HEADER.lastIndex = 0
let m: RegExpExecArray | null
let idx = 0
while ((m = KENDIMIZI_QUIZ_HEADER.exec(full)) !== null) {
  idx++
  const unitTitle = findUnitTitleBefore(full, m.index)
  if (!/9\.\s*Ünite|Modern\s+Söylem/i.test(unitTitle)) continue

  const restFromHeader = full.slice(m.index + m[0].length)
  const q1 = /(?:^|\n)\s*(1\.\s+(?!Ünite\b))/i.exec(restFromHeader)
  if (!q1 || q1.index === undefined) continue
  const globalStart =
    m.index + m[0].length + q1.index + (q1[0].length - q1[1].length)
  const tail = full.slice(globalStart)
  const yMatches: number[] = []
  {
    const r = new RegExp(yRe.source, yRe.flags.includes('g') ? yRe.flags : `${yRe.flags}g`)
    let ym: RegExpExecArray | null
    while ((ym = r.exec(tail)) !== null) yMatches.push(ym.index)
  }
  const yIdx = tail.search(yRe)
  const oIdx = tail.search(oRe)
  console.log('all yanıt header positions in tail (count', yMatches.length, '):', yMatches)
  const cap = Math.min(tail.length, 120_000)
  let end = cap
  if (yIdx < 0 && oIdx < 0) end = cap
  else if (yIdx < 0) end = oIdx
  else if (oIdx < 0) end = yIdx
  else if (oIdx < yIdx) {
    const mid = tail.slice(oIdx, yIdx)
    const has910 = /\n\s*(?:9|10)\.\s+(?!Ünite\b)/i.test(mid)
    end = has910 ? yIdx : oIdx
    console.log('mid len', mid.length, 'has910 regex', has910)
    console.log('mid sample (first 800):\n', mid.slice(0, 800))
  } else end = yIdx

  const raw = tail.slice(0, end)
  const hits9 = [...raw.matchAll(/\n\s*9\.\s+/gi)].length
  const hits10 = [...raw.matchAll(/\n\s*10\.\s+/gi)].length
  console.log('--- U9 kendimizi block ---')
  console.log('unitTitle:', unitTitle)
  console.log('tailLen', tail.length, 'yIdx', yIdx, 'oIdx', oIdx, 'chosen end', end)
  console.log('in raw slice: newline+9. count', hits9, 'newline+10. count', hits10)
  if (yIdx >= 0) {
    console.log('CONTEXT around first yanıt match:\n', tail.slice(Math.max(0, yIdx - 200), yIdx + 120))
    console.log('AFTER first yanıt (3.5k):\n', tail.slice(yIdx, yIdx + 3500))
  }
  const asIfFull = normalizeQuestionBlockLayout(
    `<<PAGE:1>>\n${tail.slice(0, Math.min(tail.length, 80000))}`,
  )
  const qs = parseMcqBlock(asIfFull)
  console.log('parseMcqBlock on tail cap 80k: question count', qs.length)
  console.log('Q9 stem:', qs[8]?.stem?.slice(0, 100))
  console.log('Q10 stem:', qs[9]?.stem?.slice(0, 100))
  console.log('raw tail last 1200 chars:\n', raw.slice(-1200))
}

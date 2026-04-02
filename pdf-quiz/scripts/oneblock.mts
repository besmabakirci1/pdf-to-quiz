import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parseMcqBlock } from '../src/lib/parseKendimizi.ts'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'
import { normalizeHyphens } from '../src/lib/parseKendimizi.ts'

function norm(s: string) {
  let t = normalizeHyphens(s).replace(/\r/g, '').trim()
  t = t.replace(/\n(\d{1,2})\s*\t\s*/g, '\n$1. ')
  t = t.replace(/\n(\d{1,2})\s+\t\s*/g, '\n$1. ')
  t = t.replace(/\n(\d{1,2})\s*\n\s+\n/g, '\n$1. ')
  t = `\n${t}`
  t = t.replace(/\n\s*(\d+)\.\s*\n+/g, '\n$1. ')
  t = t.replace(/\n\s*([a-e])\.\s*\n+/gi, '\n$1. ')
  t = t.replace(/\n\s*([A-E])[\.\)]\s*/g, (_m, L) => `\n${String(L).toLowerCase()}. `)
  return t.trim()
}

function clip(raw: string) {
  let cut = -1
  const re = /\n(\d{1,2})(?:\s+\t\s*|\s*\n\s+\n)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const n = Number(m[1])
    if (n < 1 || n > 50) continue
    const afterNum = raw.slice(m.index + m[0].length, m.index + m[0].length + 1600)
    if (!/(hangis|aşağıdak|yanlış|doğru\s+ver)/i.test(afterNum.replace(/-\s*\n\s*/g, '')))
      continue
    const tail = raw.slice(m.index, m.index + 3500)
    if (/\?/.test(tail) && /\n\s*A\./m.test(tail)) cut = m.index + 1
  }
  return cut > 0 ? raw.slice(cut).trim() : raw.trim()
}

const path = '/Users/basmabakirci/Downloads/AOFGAMZE/DİJİTAL TOPLUM TEKNOLOJİLERİ.pdf'
const data = new Uint8Array(fs.readFileSync(path))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
const parts: string[] = []
for (let i = 1; i <= doc.numPages; i++) {
  const p = await doc.getPage(i)
  const c = await p.getTextContent()
  parts.push(c.items.map((it) => ('str' in it ? it.str : '')).join('\n'))
}
const full = sanitizePdfExtractedText(parts.join('\n\n'))

let offset = 0
for (const line of full.split(/\n/)) {
  const lineStart = offset
  offset += line.length + 1
  if (!/yanıt\s+anahtarı/i.test(line)) continue
  if (/yanıtınız/i.test(line)) continue
  if (/\.{6,}/.test(line)) continue
  if (line.trim().length < 12) continue
  if (!/neler/i.test(line)) continue
  const y = lineStart + line.search(/yanıt\s+anahtarı/i)
  let raw = full.slice(Math.max(0, y - 22_000), y).trim()
  console.log('line', line, 'rawLen', raw.length)
  const clipped = clip(raw)
  console.log('clippedLen', clipped.length)
  const body = norm(clipped)
  const n = parseMcqBlock(body).length
  console.log('qs', n)
  console.log(body.slice(0, 600))
  break
}

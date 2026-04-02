import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

function sanitize(s: string) {
  return s
    .replace(/\u001d/g, 'i')
    .replace(/\u001f/g, 'i')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001c\u001e\u007f]/g, '')
}

const data = new Uint8Array(
  fs.readFileSync('/Users/basmabakirci/Downloads/AOFGAMZE/TÜRK TİYATROSU.pdf'),
)
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
const parts: string[] = []
for (let i = 1; i <= doc.numPages; i++) {
  const p = await doc.getPage(i)
  const c = await p.getTextContent()
  parts.push(c.items.map((it) => ('str' in it ? it.str : '')).join('\n'))
}
const full = sanitize(parts.join('\n\n'))
console.log('first Okuma Parçası', full.indexOf('Okuma Parçası'))
console.log('first Okuma', full.search(/\n\s*Okuma\s+Par/u))

// Simulate slice: from first real 1. after Kendimizi (approx manually)
const m = /Kendimizi\s+Sınayalım/gi
let found = 0
let match: RegExpExecArray | null
while ((match = m.exec(full)) !== null) {
  const after = full.slice(match.index + match[0].length)
  if (!/\n\s*1\.\s*[\s\S]{0,800}?\n\s*a\./i.test(after.slice(0, 8000))) continue
  const restFrom = after
  const ls = restFrom.search(/\n\s*1\.\s*/i)
  const gs = match.index + match[0].length + ls + 1
  const tail = full.slice(gs)
  const endM = tail.match(
    /\n\s*(?:Okuma Parçası|Kendimizi\s+Sınayalım\s+Yanıt\s+Anahtarı)\b/i,
  )
  console.log('real block', found, 'endM', endM?.index, 'cap', tail.length)
  found++
  if (found === 1) {
    console.log('snippet before end', JSON.stringify(tail.slice(0, 120)))
    console.log('around expected okuma', tail.indexOf('Okuma'))
  }
  if (found >= 1) {
    const oi = tail.indexOf('Okuma')
    console.log('before Okuma codes', [...tail.slice(oi - 5, oi)].map((c) => c.charCodeAt(0)))
    console.log('at Okuma', JSON.stringify(tail.slice(oi - 3, oi + 35)))
  }
  if (found >= 2) break
}

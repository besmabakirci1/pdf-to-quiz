import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { sanitizePdfExtractedText } from '../src/lib/pdfExtractCore.ts'

const path =
  process.argv[2] ??
  '/Users/basmabakirci/Downloads/AOFGAMZE/ÇAĞDAŞ TÜRK ROMANI.pdf'

const data = new Uint8Array(fs.readFileSync(path))
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
const parts: string[] = []
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const content = await page.getTextContent()
  parts.push(`<<PAGE:${i}>>`)
  parts.push(
    content.items.map((it) => ('str' in it ? it.str : '')).join('\n'),
  )
}
const full = sanitizePdfExtractedText(parts.join('\n'))

const quizHead =
  /Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım(?!\s+Yanıt)/gi
const yanıtHead =
  /Kend(?:imizi|imzi|imızı|mizi|mz)\s+S[ıi]nayalım\s+Yanıt\s+Anahtarı/gi
const caFooter =
  /Çağdaş\s+Türk\s+Romanı\s*\n\s*\d+\s*\n\s*(?=1\.\s*[a-e])/gi

console.log('--- quiz starts ---')
let m: RegExpExecArray | null
quizHead.lastIndex = 0
let qi = 0
while ((m = quizHead.exec(full)) !== null && qi < 15) {
  qi++
  console.log(qi, m.index)
}

console.log('--- yanıt Kendimizi ---')
yanıtHead.lastIndex = 0
qi = 0
while ((m = yanıtHead.exec(full)) !== null && qi < 20) {
  const tail = full.slice(m.index + m[0].length)
  const has = /(?:^|\n)\s*1\.\s*[a-e]\b/i.test(tail.slice(0, 8000))
  const sıra = tail.search(/\n\s*Sıra\s+Sizde\s+Yanıt\s+Anahtarı/i)
  const fa = tail.search(/(?:^|\n)\s*\d+\.\s*[a-e]\b/i)
  const skip = sıra >= 0 && fa >= 0 && sıra < fa
  qi++
  console.log(qi, m.index, 'has1', has, 'skipSıra', skip)
}

console.log('--- Çağdaş footer answer blocks ---')
caFooter.lastIndex = 0
qi = 0
while ((m = caFooter.exec(full)) !== null && qi < 10) {
  qi++
  console.log(qi, m.index)
}

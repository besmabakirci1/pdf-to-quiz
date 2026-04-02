import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { sanitizePdfExtractedText } from './pdfExtractCore'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export { pageTextFromPdfItems, sanitizePdfExtractedText } from './pdfExtractCore'

/**
 * Tüm sayfaların metnini çıkarır.
 * Öğe sırası PDF’e göre değişir; Anadolu kitaplarında satır-bazlı birleştirme
 * genelde koordinat kümelendirmesinden daha fazla soru yakalıyor.
 */
export async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .join('\n')
    parts.push(line)
  }
  return sanitizePdfExtractedText(parts.join('\n\n'))
}

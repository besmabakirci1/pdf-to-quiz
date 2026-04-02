import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { sanitizePdfExtractedText } from './pdfExtractCore'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const RENDER_SCALE = 2.25

/**
 * PDF.js ile sayfayı kanvas üzerinde çizer (vektör + gömülü görseller dahil).
 * Tarayıcıda çalışır; sunucu gerekmez.
 */
async function renderSinglePageDataUrl(
  page: pdfjs.PDFPageProxy,
  scale: number,
): Promise<string> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.88)
}

/**
 * Metin çıkarımında her sayfa öncesine `<<PAGE:n>>` yerleştirir (soru–sayfa eşlemesi için).
 * İstenen sayfaları JPEG data URL olarak rasterize eder.
 */
export async function loadPdfQuizBundle(file: File): Promise<{
  markedText: string
  renderPages: (oneBasedIndices: number[]) => Promise<Record<number, string>>
}> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const parts: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    parts.push(`<<PAGE:${i}>>`)
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    parts.push(
      content.items.map((it) => ('str' in it ? it.str : '')).join('\n'),
    )
  }

  const markedText = sanitizePdfExtractedText(parts.join('\n'))

  const renderPages = async (oneBasedIndices: number[]) => {
    const out: Record<number, string> = {}
    const dpr =
      typeof window !== 'undefined' && window.devicePixelRatio
        ? window.devicePixelRatio
        : 1
    const scale = Math.min(2.75, Math.max(RENDER_SCALE, dpr * 1.35))
    const uniq = [...new Set(oneBasedIndices)].sort((a, b) => a - b)
    for (const n of uniq) {
      if (n < 1 || n > doc.numPages) continue
      const page = await doc.getPage(n)
      out[n] = await renderSinglePageDataUrl(page, scale)
    }
    return out
  }

  return { markedText, renderPages }
}

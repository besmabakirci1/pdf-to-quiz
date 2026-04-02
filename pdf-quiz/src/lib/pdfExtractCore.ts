/**
 * Tarayıcı dışında da kullanılabilir: worker / Vite ?url içermez.
 */

export function sanitizePdfExtractedText(s: string): string {
  return s
    .replace(/\u001d/g, 'i')
    .replace(/\u001f/g, 'i')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001c\u001e\u007f]/g, '')
}

const LINE_Y_TOL = 4

export function pageTextFromPdfItems(
  items: Array<{ str?: string; transform?: number[] }>,
): string {
  type P = { x: number; y: number; str: string }
  const pts: P[] = []
  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    const str = typeof it.str === 'string' ? it.str : ''
    if (!str) continue
    const tr = Array.isArray(it.transform) ? it.transform : [1, 0, 0, 1, 0, 0]
    pts.push({ x: tr[4], y: tr[5], str })
  }
  if (pts.length === 0) return ''

  pts.sort((a, b) => {
    const dy = b.y - a.y
    if (Math.abs(dy) > LINE_Y_TOL) return dy
    return a.x - b.x
  })

  const lines: string[] = []
  let row: P[] = [pts[0]]
  let rowY = pts[0].y

  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]
    if (Math.abs(p.y - rowY) <= LINE_Y_TOL) {
      row.push(p)
      rowY = (rowY * (row.length - 1) + p.y) / row.length
    } else {
      row.sort((a, b) => a.x - b.x)
      lines.push(row.map((r) => r.str).join(' '))
      row = [p]
      rowY = p.y
    }
  }
  row.sort((a, b) => a.x - b.x)
  lines.push(row.map((r) => r.str).join(' '))

  return lines.join('\n')
}

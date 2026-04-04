const STORAGE_PREFIX = 'pdf-quiz-solved:v1:'
const FLAGGED_PREFIX = 'pdf-quiz-flagged:v1:'

/** Aynı isimli iki dosyayı ayırt etmek için boyut da kullanılır (tarayıcıda kalıcı, cihaza özel). */
export function docFingerprint(fileName: string, byteSize: number): string {
  return `${fileName}::${byteSize}`
}

function storageKey(fp: string): string {
  return STORAGE_PREFIX + encodeURIComponent(fp)
}

function flaggedStorageKey(fp: string): string {
  return FLAGGED_PREFIX + encodeURIComponent(fp)
}

export function questionProgressId(sectionId: string, questionNumber: number): string {
  return `${sectionId}#${questionNumber}`
}

export function loadSolvedQuestionIds(fp: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(fp))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

export function persistSolvedQuestionIds(fp: string, ids: Set<string>): void {
  try {
    localStorage.setItem(storageKey(fp), JSON.stringify([...ids]))
  } catch {
    /* private mode / kota */
  }
}

export function loadFlaggedQuestionIds(fp: string): Set<string> {
  try {
    const raw = localStorage.getItem(flaggedStorageKey(fp))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

export function persistFlaggedQuestionIds(fp: string, ids: Set<string>): void {
  try {
    localStorage.setItem(flaggedStorageKey(fp), JSON.stringify([...ids]))
  } catch {
    /* private mode / kota */
  }
}

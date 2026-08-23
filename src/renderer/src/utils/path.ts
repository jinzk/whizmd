/** Renderer-side path helpers (no node:path in the sandboxed window). */

export function isAbsolutePath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\')
}

/** Convert a media:// URL back to its local path for user-entered sources. */
export function mediaUrlToPath(value: string): string {
  const url = new URL(value)
  const pathname = decodeURIComponent(url.pathname)
  if (/^[a-z]$/i.test(url.hostname)) return `${url.hostname}:${pathname}`
  if (url.hostname) return `//${url.hostname}${pathname}`
  return pathname
}

export function dirnamePath(p: string): string {
  const normalized = p.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) {
    return normalized === '' ? '' : normalized.slice(0, idx === 0 ? 1 : idx)
  }
  return normalized.slice(0, idx)
}

export function normalizeSeparators(p: string): string {
  return p.replace(/\\/g, '/')
}

/**
 * Resolve a relative path against a base directory. Returns the forward-slash
 * normalized absolute path.
 */
export function resolveRelative(baseDir: string, rel: string): string {
  const cleanRel = rel.replace(/^\.\//, '')
  const dir = normalizeSeparators(baseDir).replace(/\/+$/, '')
  const joined = `${dir}/${normalizeSeparators(cleanRel)}`
  return collapseSegments(joined)
}

/** Resolve "." and ".." segments without touching the filesystem. */
export function collapseSegments(p: string): string {
  const parts = p.split('/')
  const stack: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue
    }
    if (part === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') {
        stack.pop()
      } else {
        stack.push(part)
      }
    } else {
      stack.push(part)
    }
  }
  const prefix = p.startsWith('/') ? '/' : ''
  const drive = /^[a-zA-Z]:$/.test(stack[0] ?? '') ? `${stack.shift()}/` : ''
  return prefix + drive + stack.join('/')
}

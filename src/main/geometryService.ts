import { dirname, isAbsolute, resolve } from 'node:path'

function decodeMediaPath(source: string): string {
  if (!/^media:/i.test(source)) return source
  const path = decodeURIComponent(source.replace(/^media:\/\//i, ''))
  // URL form media:///C:/... becomes /C:/... after the scheme is removed.
  return path.replace(/^\/([A-Za-z]:[\\/])/, '$1')
}

export function sanitizeGeometrySvg(svg: string): string | null {
  if (!/<svg\b/i.test(svg) || /<script\b|\son[a-z]+\s*=|javascript:/i.test(svg)) return null
  return svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '')
}

export function resolveGeometryPath(source: string, docPath: string | null): string | null {
  source = decodeMediaPath(source)
  if (isAbsolute(source)) return resolve(source)
  return docPath ? resolve(dirname(docPath), source) : null
}

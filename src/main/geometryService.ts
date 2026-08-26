import { dirname, isAbsolute, resolve } from 'node:path'

export function sanitizeGeometrySvg(svg: string): string | null {
  if (!/<svg\b/i.test(svg) || /<script\b|\son[a-z]+\s*=|javascript:/i.test(svg)) return null
  return svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '')
}

export function resolveGeometryPath(source: string, docPath: string | null): string | null {
  if (isAbsolute(source)) return resolve(source)
  return docPath ? resolve(dirname(docPath), source) : null
}

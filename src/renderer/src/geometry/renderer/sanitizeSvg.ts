export function sanitizeGeometrySvg(svg: string): string | null {
  if (!/<svg\b/i.test(svg) || /<script\b|\son[a-z]+\s*=|javascript:/i.test(svg)) return null
  return svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '')
}

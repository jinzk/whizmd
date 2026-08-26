import type { GeometryDocument } from '../core/model'

export function serializeGeometry(document: GeometryDocument): string {
  return JSON.stringify(document)
}

export function deserializeGeometry(value: string): GeometryDocument | null {
  try {
    const parsed = JSON.parse(value) as GeometryDocument
    return parsed?.version === 1 && Array.isArray(parsed.objects) ? { ...parsed, constraints: parsed.constraints ?? [], topology: parsed.topology ?? { nodeIds: parsed.objects.filter((object) => object.type === 'point').map((object) => object.id) } } : null
  } catch {
    return null
  }
}

export function deserializeGeometrySvg(svg: string): GeometryDocument | null {
  const match = svg.match(/<metadata\s+id=["']whizmd-geometry["'][^>]*>([\s\S]*?)<\/metadata>/i)
  if (!match) return null
  const decoded = match[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  return deserializeGeometry(decoded)
}

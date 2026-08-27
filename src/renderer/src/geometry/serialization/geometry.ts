import type { GeometryDocument } from '../core/model'

export function serializeGeometry(document: GeometryDocument): string {
  return JSON.stringify(document)
}

export function deserializeGeometry(value: string): GeometryDocument | null {
  try {
    const parsed = JSON.parse(value) as GeometryDocument
    if (parsed?.version !== 1) return null
    const points = parsed.points ?? []
    const segments = parsed.segments ?? []
    const curves = parsed.curves ?? []
    const annotations = parsed.annotations ?? []
    if (!Array.isArray(points) || !Array.isArray(segments) || !Array.isArray(curves) || !Array.isArray(annotations)) return null
    return { ...parsed, points, segments, curves, annotations, constraints: parsed.constraints ?? [], topology: parsed.topology ?? { nodeIds: points.map((object) => object.id) }, shapes: parsed.shapes ?? [], sharedNodes: parsed.sharedNodes ?? [], dependencies: parsed.dependencies ?? [] }
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

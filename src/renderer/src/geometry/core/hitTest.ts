import type { GeometryDocument } from './model'
import { angleInSpan, getArcAngles, resolveArcPoint, resolvePoint } from './calculations'
import { getGeometryCurves } from './curves'

export type GeometryHit = { id: string; distance: number }
function distanceToSegment(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x; const dy = b.y - a.y; const size = dx * dx + dy * dy
  if (!size) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / size))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}
export function hitTest(document: GeometryDocument, point: { x: number; y: number }, tolerance = 8): GeometryHit[] {
  return [...document.points, ...document.segments, ...document.curves].map((object) => {
    if (object.type === 'point') return { id: object.id, distance: Math.hypot(point.x - object.x, point.y - object.y) }
    if (object.type === 'segment') { const a = resolvePoint(document, object.start); const b = resolvePoint(document, object.end); return { id: object.id, distance: a && b ? distanceToSegment(point, a, b) : Infinity } }
    if (object.type === 'circle') { const center = resolvePoint(document, object.center); return { id: object.id, distance: center ? Math.abs(Math.hypot(point.x - center.x, point.y - center.y) - object.radius) : Infinity } }
    if (object.type === 'arc') {
      const center = resolvePoint(document, object.center)
      if (!center) return { id: object.id, distance: Infinity }
      const { startAngle, endAngle } = getArcAngles(document, object)
      const dx = point.x - center.x; const dy = point.y - center.y
      const angle = Math.atan2(dy, dx)
      if (angleInSpan(angle, startAngle, endAngle)) return { id: object.id, distance: Math.abs(Math.hypot(dx, dy) - object.radius) }
      const start = resolveArcPoint(center, object.radius, startAngle)
      const end = resolveArcPoint(center, object.radius, endAngle)
      return { id: object.id, distance: Math.min(Math.hypot(point.x - start.x, point.y - start.y), Math.hypot(point.x - end.x, point.y - end.y)) }
    }
    return { id: object.id, distance: Infinity }
  }).filter((hit) => hit.distance <= tolerance).sort((a, b) => a.distance - b.distance)
}

export { getGeometryCurves }

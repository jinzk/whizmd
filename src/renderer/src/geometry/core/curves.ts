import type { GeometryDocument, GeometrySegment } from './model'
import { angleInSpan, getArcAngles, resolveArcPoint, resolvePoint } from './calculations'

export type GeometryCoordinate = { x: number; y: number }
export type CurveProjection = { point: GeometryCoordinate; parameter: number; distance: number; inside: boolean }
export type GeometryCurve = {
  id: string
  kind: 'segment' | 'circle' | 'arc'
  project(point: GeometryCoordinate): CurveProjection | null
}

function segmentProjection(document: GeometryDocument, segment: GeometrySegment, point: GeometryCoordinate): CurveProjection | null {
  const start = resolvePoint(document, segment.start); const end = resolvePoint(document, segment.end)
  if (!start || !end) return null
  const dx = end.x - start.x; const dy = end.y - start.y; const squared = dx * dx + dy * dy
  const raw = squared ? ((point.x - start.x) * dx + (point.y - start.y) * dy) / squared : 0
  const parameter = Math.max(0, Math.min(1, raw))
  const projected = { x: start.x + parameter * dx, y: start.y + parameter * dy }
  return { point: projected, parameter, distance: Math.hypot(point.x - projected.x, point.y - projected.y), inside: raw >= 0 && raw <= 1 }
}

export function getGeometryCurves(document: GeometryDocument): GeometryCurve[] {
  return document.objects.flatMap((object): GeometryCurve[] => {
    if (object.type === 'segment') return [{ id: object.id, kind: 'segment', project: (point) => segmentProjection(document, object, point) }]
    if (object.type === 'circle') {
      const center = resolvePoint(document, object.center)
      if (!center) return []
      return [{ id: object.id, kind: 'circle', project: (point) => {
        const dx = point.x - center.x; const dy = point.y - center.y; const distance = Math.hypot(dx, dy)
        if (!distance) return null
        return { point: { x: center.x + dx * object.radius / distance, y: center.y + dy * object.radius / distance }, parameter: Math.atan2(dy, dx), distance: Math.abs(distance - object.radius), inside: true }
      } }]
    }
    if (object.type === 'arc') {
      const center = resolvePoint(document, object.center)
      if (!center) return []
      const { startAngle, endAngle } = getArcAngles(document, object)
      return [{ id: object.id, kind: 'arc', project: (point) => {
        const dx = point.x - center.x; const dy = point.y - center.y
        const angle = Math.atan2(dy, dx)
        if (angleInSpan(angle, startAngle, endAngle)) {
          const distance = Math.hypot(dx, dy)
          if (!distance) return null
          return { point: { x: center.x + Math.cos(angle) * object.radius, y: center.y + Math.sin(angle) * object.radius }, parameter: angle, distance: Math.abs(distance - object.radius), inside: true }
        }
        const start = resolveArcPoint(center, object.radius, startAngle)
        const end = resolveArcPoint(center, object.radius, endAngle)
        const startDistance = Math.hypot(point.x - start.x, point.y - start.y)
        const endDistance = Math.hypot(point.x - end.x, point.y - end.y)
        return startDistance <= endDistance
          ? { point: start, parameter: startAngle, distance: startDistance, inside: false }
          : { point: end, parameter: endAngle, distance: endDistance, inside: false }
      } }]
    }
    return []
  })
}

import type { GeometryArc, GeometryDocument, GeometryEllipse, GeometrySegment } from './model'

export type Coordinate = { x: number; y: number }

export function resolvePoint(document: GeometryDocument, id: string, seen = new Set<string>()): Coordinate | null {
  if (seen.has(id)) return null
  seen.add(id)
  const object = document.objects.find((item) => item.id === id)
  if (!object) return null
  if (object.type === 'point' || object.type === 'text') return object.type === 'point' ? object : { x: object.x, y: object.y }
  if (object.type === 'midpoint') {
    const a = resolvePoint(document, object.a, seen); const b = resolvePoint(document, object.b, seen)
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null
  }
  if (object.type === 'perpendicularFoot') {
    const point = resolvePoint(document, object.point, seen); const segment = document.objects.find((item) => item.id === object.line)
    if (!point || !segment || segment.type !== 'segment') return null
    return projectPointToSegment(document, point, segment)
  }
  if (object.type === 'intersection') {
    const first = document.objects.find((item) => item.id === object.lineA); const second = document.objects.find((item) => item.id === object.lineB)
    if (!first || !second || first.type !== 'segment' || second.type !== 'segment') return null
    return intersectSegments(document, first, second)
  }
  return null
}

export function projectPointToSegment(document: GeometryDocument, point: Coordinate, segment: GeometrySegment): Coordinate | null {
  const a = resolvePoint(document, segment.start); const b = resolvePoint(document, segment.end)
  if (!a || !b) return null
  const dx = b.x - a.x; const dy = b.y - a.y; const lengthSquared = dx * dx + dy * dy
  if (!lengthSquared) return a
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

export function intersectSegments(document: GeometryDocument, first: GeometrySegment, second: GeometrySegment): Coordinate | null {
  const a = resolvePoint(document, first.start); const b = resolvePoint(document, first.end); const c = resolvePoint(document, second.start); const d = resolvePoint(document, second.end)
  if (!a || !b || !c || !d) return null
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x)
  if (Math.abs(denominator) < 1e-9) return null
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator
  const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) } : null
}

export function resolveArcPoint(center: Coordinate, radius: number, angle: number): Coordinate {
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
}

export type EllipseGeometry = { center: Coordinate; radiusX: number; radiusY: number; rotation: number }

export function resolveEllipseGeometry(document: GeometryDocument, ellipse: GeometryEllipse): EllipseGeometry | null {
  const focusA = resolvePoint(document, ellipse.focusA)
  const focusB = resolvePoint(document, ellipse.focusB)
  if (!focusA || !focusB) return null
  const dx = focusB.x - focusA.x
  const dy = focusB.y - focusA.y
  const focalHalfDistance = Math.hypot(dx, dy) / 2
  const radiusX = Math.max(focalHalfDistance, ellipse.semiMajor)
  const radiusY = Math.sqrt(Math.max(0, radiusX * radiusX - focalHalfDistance * focalHalfDistance))
  return { center: { x: (focusA.x + focusB.x) / 2, y: (focusA.y + focusB.y) / 2 }, radiusX, radiusY, rotation: Math.atan2(dy, dx) }
}

export function angleInSpan(angle: number, startAngle: number, endAngle: number): boolean {
  const twoPi = Math.PI * 2
  const normalized = (angle - startAngle % twoPi + twoPi * 2) % twoPi
  const span = (endAngle - startAngle) % twoPi
  return normalized <= (span <= 0 ? span + twoPi : span)
}

export function getArcAngles(document: GeometryDocument, arc: GeometryArc): { startAngle: number; endAngle: number } {
  const angleFor = (anchorId: string | undefined, fallback: number): number => {
    if (!anchorId) return fallback
    const point = resolvePoint(document, anchorId)
    if (!point) return fallback
    const center = resolvePoint(document, arc.center)
    if (!center) return fallback
    return Math.atan2(point.y - center.y, point.x - center.x)
  }
  return { startAngle: angleFor(arc.startAnchor, arc.startAngle), endAngle: angleFor(arc.endAnchor, arc.endAngle) }
}

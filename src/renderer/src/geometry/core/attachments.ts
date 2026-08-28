import type { GeometryDocument, GeometryPoint } from './model'
import { movePoint } from './model'
import { angleInSpan, getArcAngles, resolveArcPoint, resolveEllipseGeometry, resolvePoint } from './calculations'

/** Moves implicit points along a segment when that segment's endpoints change. */
export function moveAttachedPoints(previous: GeometryDocument, next: GeometryDocument): GeometryDocument {
  let result = next
  for (const segment of previous.segments) {
    const nextSegment = next.segments.find((item) => item.id === segment.id)
    if (!nextSegment) continue
    const previousStart = resolvePoint(previous, segment.start); const previousEnd = resolvePoint(previous, segment.end)
    const nextStart = resolvePoint(next, nextSegment.start); const nextEnd = resolvePoint(next, nextSegment.end)
    if (!previousStart || !previousEnd || !nextStart || !nextEnd) continue
    if (previousStart.x === nextStart.x && previousStart.y === nextStart.y && previousEnd.x === nextEnd.x && previousEnd.y === nextEnd.y) continue
    const dx = previousEnd.x - previousStart.x; const dy = previousEnd.y - previousStart.y
    const lengthSquared = dx * dx + dy * dy
    if (!lengthSquared) continue
    const nextDx = nextEnd.x - nextStart.x; const nextDy = nextEnd.y - nextStart.y
    for (const point of previous.points) {
      if (point.id === segment.start || point.id === segment.end) continue
      const t = ((point.x - previousStart.x) * dx + (point.y - previousStart.y) * dy) / lengthSquared
      const distance = Math.abs((point.x - previousStart.x) * dy - (point.y - previousStart.y) * dx) / Math.sqrt(lengthSquared)
      if (t <= 0 || t >= 1 || distance > 1e-4) continue
      result = movePoint(result, point.id, nextStart.x + t * nextDx, nextStart.y + t * nextDy)
    }
  }
  for (const arc of previous.curves.filter((object): object is Extract<typeof object, { type: 'arc' }> => object.type === 'arc')) {
    const nextArc = next.curves.find((object): object is Extract<typeof object, { type: 'arc' }> => object.type === 'arc' && object.id === arc.id)
    if (!nextArc) continue
    const previousCenter = resolvePoint(previous, arc.center); const nextCenter = resolvePoint(next, nextArc.center)
    if (!previousCenter || !nextCenter) continue
    if (previousCenter.x === nextCenter.x && previousCenter.y === nextCenter.y && arc.radius === nextArc.radius && arc.startAngle === nextArc.startAngle && arc.endAngle === nextArc.endAngle && arc.startAnchor === nextArc.startAnchor && arc.endAnchor === nextArc.endAnchor) continue
    const { startAngle, endAngle } = getArcAngles(previous, arc)
    for (const point of previous.points) {
      if (point.id === arc.center || point.id === arc.startAnchor || point.id === arc.endAnchor) continue
      const dx = point.x - previousCenter.x; const dy = point.y - previousCenter.y
      const radius = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx)
      if (!radius || !angleInSpan(angle, startAngle, endAngle) || Math.abs(radius - arc.radius) > 1e-4) continue
      result = movePoint(result, point.id, nextCenter.x + nextArc.radius * Math.cos(angle), nextCenter.y + nextArc.radius * Math.sin(angle))
    }
  }
  for (const curve of previous.curves) {
    if (curve.type !== 'circle' && curve.type !== 'ellipse') continue
    const nextCurve = next.curves.find((object) => object.id === curve.id)
    if (!nextCurve || nextCurve.type !== curve.type) continue
    const previousCenter = curve.type === 'circle' ? resolvePoint(previous, curve.center) : resolveEllipseGeometry(previous, curve)?.center
    const nextCenter = nextCurve.type === 'circle' ? resolvePoint(next, nextCurve.center) : resolveEllipseGeometry(next, nextCurve)?.center
    if (!previousCenter || !nextCenter) continue
    for (const point of previous.points) {
      const attachment = point.attachment
      if (!attachment || attachment.objectId !== curve.id || attachment.kind !== curve.type) continue
      if (curve.type === 'circle' && nextCurve.type === 'circle') result = movePoint(result, point.id, nextCenter.x + nextCurve.radius * Math.cos(attachment.parameter), nextCenter.y + nextCurve.radius * Math.sin(attachment.parameter))
      if (curve.type === 'ellipse' && nextCurve.type === 'ellipse') {
        const geometry = resolveEllipseGeometry(next, nextCurve)
        if (geometry) {
          const cos = Math.cos(geometry.rotation); const sin = Math.sin(geometry.rotation)
          const x = geometry.radiusX * Math.cos(attachment.parameter); const y = geometry.radiusY * Math.sin(attachment.parameter)
          result = movePoint(result, point.id, geometry.center.x + x * cos - y * sin, geometry.center.y + x * sin + y * cos)
        }
      }
    }
  }
  return result
}

export function findAttachedSegment(document: GeometryDocument, pointId: string): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
  const point = resolvePoint(document, pointId)
  if (!point) return null
  for (const line of document.segments) {
    const start = resolvePoint(document, line.start); const end = resolvePoint(document, line.end)
    if (!start || !end) continue
    const dx = end.x - start.x; const dy = end.y - start.y; const lengthSquared = dx * dx + dy * dy
    if (!lengthSquared) continue
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    const distance = Math.abs((point.x - start.x) * dy - (point.y - start.y) * dx) / Math.sqrt(lengthSquared)
    if (t > 0 && t < 1 && distance <= 1e-4) return { start, end }
  }
  return null
}

export function findAttachedArc(document: GeometryDocument, pointId: string): { center: { x: number; y: number }; radius: number; startAngle: number; endAngle: number } | null {
  const point = resolvePoint(document, pointId)
  if (!point) return null
  for (const arc of document.curves.filter((object): object is Extract<typeof object, { type: 'arc' }> => object.type === 'arc')) {
    const stored = document.points.find((item): item is GeometryPoint => item.id === pointId && item.attachment?.kind === 'arc' && item.attachment.objectId === arc.id)?.attachment
    if (stored) {
      const center = resolvePoint(document, arc.center)
      if (!center) continue
      const angles = getArcAngles(document, arc)
      return { center, radius: arc.radius, ...angles }
    }
    if (arc.startAnchor === pointId || arc.endAnchor === pointId) continue
    const center = resolvePoint(document, arc.center)
    if (!center) continue
    const dx = point.x - center.x; const dy = point.y - center.y
    const radius = Math.hypot(dx, dy); const angle = Math.atan2(dy, dx)
    const angles = getArcAngles(document, arc)
    if (radius && Math.abs(radius - arc.radius) <= 1e-4 && angleInSpan(angle, angles.startAngle, angles.endAngle)) return { center, radius: arc.radius, ...angles }
  }
  return null
}

export function projectPointToArc(document: GeometryDocument, pointId: string, cursor: { x: number; y: number }): { x: number; y: number } | null {
  const attachment = findAttachedArc(document, pointId)
  if (!attachment) return null
  const angle = Math.atan2(cursor.y - attachment.center.y, cursor.x - attachment.center.x)
  if (angleInSpan(angle, attachment.startAngle, attachment.endAngle)) return resolveArcPoint(attachment.center, attachment.radius, angle)
  const start = resolveArcPoint(attachment.center, attachment.radius, attachment.startAngle)
  const end = resolveArcPoint(attachment.center, attachment.radius, attachment.endAngle)
  return Math.hypot(cursor.x - start.x, cursor.y - start.y) <= Math.hypot(cursor.x - end.x, cursor.y - end.y) ? start : end
}

export function projectAttachedCurvePoint(document: GeometryDocument, pointId: string, cursor: { x: number; y: number }): { x: number; y: number } | null {
  const point = document.points.find((item) => item.id === pointId)
  const attachment = point?.attachment
  if (!attachment || (attachment.kind !== 'circle' && attachment.kind !== 'ellipse')) return null
  const curve = document.curves.find((item) => item.id === attachment.objectId)
  if (!curve || curve.type !== attachment.kind) return null
  if (curve.type === 'circle') {
    const center = resolvePoint(document, curve.center)
    if (!center) return null
    const angle = Math.atan2(cursor.y - center.y, cursor.x - center.x)
    return { x: center.x + curve.radius * Math.cos(angle), y: center.y + curve.radius * Math.sin(angle) }
  }
  const geometry = resolveEllipseGeometry(document, curve)
  if (!geometry) return null
  const cos = Math.cos(geometry.rotation); const sin = Math.sin(geometry.rotation)
  const dx = cursor.x - geometry.center.x; const dy = cursor.y - geometry.center.y
  const localX = dx * cos + dy * sin; const localY = -dx * sin + dy * cos
  let angle = Math.atan2(localY / geometry.radiusY, localX / geometry.radiusX)
  // Find the closest point on the ellipse, rather than the radial intersection.
  let step = Math.PI / 8
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const candidates = [angle - step, angle, angle + step]
    const distanceSquared = (candidate: number): number => (geometry.radiusX * Math.cos(candidate) - localX) ** 2 + (geometry.radiusY * Math.sin(candidate) - localY) ** 2
    const best = candidates.reduce((current, candidate) => distanceSquared(candidate) < distanceSquared(current) ? candidate : current, angle)
    angle = best
    step /= 2
  }
  const x = geometry.radiusX * Math.cos(angle); const y = geometry.radiusY * Math.sin(angle)
  return { x: geometry.center.x + x * cos - y * sin, y: geometry.center.y + x * sin + y * cos }
}

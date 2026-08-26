import type { GeometryDocument, GeometrySegment } from '../core/model'
import { intersectSegments, resolvePoint } from '../core/calculations'

export type GeometryMarker =
  | { kind: 'tick'; index: number; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'rightAngle'; index: number; path: string }
  | { kind: 'ring'; index: number; cx: number; cy: number }

const TICK_LENGTH = 5

function getSegment(document: GeometryDocument, id: string): GeometrySegment | null {
  const object = document.objects.find((item) => item.id === id)
  return object?.type === 'segment' ? object : null
}

function endpoints(document: GeometryDocument, id: string) {
  const segment = getSegment(document, id)
  if (!segment) return null
  const start = resolvePoint(document, segment.start); const end = resolvePoint(document, segment.end)
  return start && end ? { start, end } : null
}

export function getConstraintMarkers(document: GeometryDocument): GeometryMarker[] {
  const markers: GeometryMarker[] = []
  document.constraints.forEach((constraint, index) => {
    if (constraint.type === 'parallel' || constraint.type === 'equalLength') {
      const ids = constraint.type === 'parallel' ? [constraint.lineA, constraint.lineB] : [constraint.segmentA, constraint.segmentB]
      ids.forEach((id) => {
        const points = endpoints(document, id)
        if (!points) return
        const mid = { x: (points.start.x + points.end.x) / 2, y: (points.start.y + points.end.y) / 2 }
        const dx = points.end.x - points.start.x; const dy = points.end.y - points.start.y
        const size = Math.hypot(dx, dy)
        if (!size) return
        const ux = dx / size; const uy = dy / size
        const rx = (ux - uy) * Math.SQRT1_2; const ry = (ux + uy) * Math.SQRT1_2
        markers.push({ kind: 'tick', index, x1: mid.x - rx * TICK_LENGTH, y1: mid.y - ry * TICK_LENGTH, x2: mid.x + rx * TICK_LENGTH, y2: mid.y + ry * TICK_LENGTH })
      })
      return
    }
    if (constraint.type === 'perpendicular') {
      const first = getSegment(document, constraint.lineA); const second = getSegment(document, constraint.lineB)
      if (!first || !second) return
      const corner = intersectSegments(document, first, second)
      if (!corner) return
      const legPoints = [[first.start, first.end], [second.start, second.end]].map(([fromId, toId]) => {
        const from = resolvePoint(document, fromId)!; const to = resolvePoint(document, toId)!
        const size = Math.hypot(from.x - corner.x, from.y - corner.y)
        return size > Math.hypot(to.x - corner.x, to.y - corner.y) ? from : to
      })
      const legs = legPoints.map((point) => {
        const size = Math.hypot(point.x - corner.x, point.y - corner.y)
        return size ? { x: (point.x - corner.x) / size, y: (point.y - corner.y) / size } : null
      })
      if (legs.some((leg) => !leg)) return
      const [u, v] = legs as [{ x: number; y: number }, { x: number; y: number }]
      const reach = 9
      const a = { x: corner.x + u.x * reach, y: corner.y + u.y * reach }
      const b = { x: corner.x + v.x * reach, y: corner.y + v.y * reach }
      const c = { x: a.x + v.x * reach, y: a.y + v.y * reach }
      markers.push({ kind: 'rightAngle', index, path: `M ${a.x} ${a.y} L ${c.x} ${c.y} L ${b.x} ${b.y}` })
      return
    }
    if (constraint.type === 'pointOnLine') {
      const attached = resolvePoint(document, constraint.point)
      if (!attached) return
      markers.push({ kind: 'ring', index, cx: attached.x, cy: attached.y })
    }
  })
  return markers
}

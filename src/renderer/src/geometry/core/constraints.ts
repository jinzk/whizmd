import { getGeometryObject, type GeometryDocument } from './model'
import { angleBetweenPoints, intersectSegments, resolvePoint } from './calculations'

export type GeometryConstraint =
  | ({ type: 'coincident'; pointA: string; pointB: string })
  | ({ type: 'horizontal'; segment: string })
  | ({ type: 'vertical'; segment: string })
  | ({ type: 'pointOnLine'; point: string; line: string; t?: number })
  | ({ type: 'midpoint'; point: string; line: string })
  | ({ type: 'intersection'; point: string; lineA: string; lineB: string })
  | ({ type: 'perpendicular'; lineA: string; lineB: string })
  | ({ type: 'parallel'; lineA: string; lineB: string })
  | ({ type: 'equalLength'; segmentA: string; segmentB: string })
  | ({ type: 'fixedDistance'; a: string; b: string; value: number })
  | ({ type: 'fixedAngle'; a: string; vertex: string; b: string; value: number })
  | ({ type: 'tangent'; curveA: string; curveB: string })
  | ({ type: 'symmetric'; a: string; b: string; mirror: string })

export type ConstraintResult = { valid: boolean; error: number; message?: string }

export function constraintPriority(constraint: GeometryConstraint): number {
  if (constraint.type === 'coincident') return 0
  if (constraint.type === 'pointOnLine' || constraint.type === 'midpoint' || constraint.type === 'intersection') return 3
  if (constraint.type === 'symmetric') return 2
  return 1
}

const EPSILON = 1e-6

function segment(document: GeometryDocument, id: string) {
  const object = getGeometryObject(document, id)
  return object?.type === 'segment' ? object : null
}

function vector(document: GeometryDocument, id: string) {
  const item = segment(document, id)
  if (!item) return null
  const start = resolvePoint(document, item.start); const end = resolvePoint(document, item.end)
  return start && end ? { x: end.x - start.x, y: end.y - start.y } : null
}

function length(value: { x: number; y: number }): number { return Math.hypot(value.x, value.y) }

function radiusOf(document: GeometryDocument, id: string): { center: { x: number; y: number }; radius: number } | null {
  const object = getGeometryObject(document, id)
  if (!object) return null
  if (object.type === 'circle' || object.type === 'arc') {
    const center = resolvePoint(document, object.center)
    return center ? { center, radius: object.radius } : null
  }
  return null
}

export function evaluateConstraint(document: GeometryDocument, constraint: GeometryConstraint): ConstraintResult {
  if (constraint.type === 'tangent') {
    const first = radiusOf(document, constraint.curveA)
    const second = radiusOf(document, constraint.curveB)
    const firstSegment = !first ? segment(document, constraint.curveA) : null
    const secondSegment = !second ? segment(document, constraint.curveB) : null
    if (first && second) {
      const distance = Math.hypot(first.center.x - second.center.x, first.center.y - second.center.y)
      const external = Math.abs(distance - (first.radius + second.radius))
      const internal = Math.abs(distance - Math.abs(first.radius - second.radius))
      const error = Math.min(external, internal)
      return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : 'Curves are not tangent' }
    }
    const circle = first ?? second
    const line = firstSegment ?? secondSegment
    if (!circle || !line) return { valid: false, error: Infinity, message: 'Missing curve' }
    const start = resolvePoint(document, line.start); const end = resolvePoint(document, line.end)
    if (!start || !end) return { valid: false, error: Infinity, message: 'Missing line endpoint' }
    const cross = (circle.center.x - start.x) * (end.y - start.y) - (circle.center.y - start.y) * (end.x - start.x)
    const length = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y))
    const error = Math.abs(Math.abs(cross) / length - circle.radius)
    return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : 'Line and curve are not tangent' }
  }
  if (constraint.type === 'symmetric') {
    const a = resolvePoint(document, constraint.a); const b = resolvePoint(document, constraint.b)
    const mirror = segment(document, constraint.mirror)
    if (!a || !b || !mirror) return { valid: false, error: Infinity, message: 'Missing points or axis' }
    const start = resolvePoint(document, mirror.start); const end = resolvePoint(document, mirror.end)
    if (!start || !end) return { valid: false, error: Infinity, message: 'Missing axis endpoint' }
    const dx = end.x - start.x; const dy = end.y - start.y; const lengthSquared = Math.max(1e-12, dx * dx + dy * dy)
    const offset = (points: { x: number; y: number }): number => {
      const cross = (points.x - start.x) * dy - (points.y - start.y) * dx
      return Math.abs(cross) / Math.sqrt(lengthSquared)
    }
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const abx = b.x - a.x; const aby = b.y - a.y
    const error = offset(midpoint) + Math.abs(abx * dx + aby * dy) / Math.sqrt(lengthSquared)
    return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : 'Points are not symmetric about the axis' }
  }
  if (constraint.type === 'coincident') {
    const first = resolvePoint(document, constraint.pointA); const second = resolvePoint(document, constraint.pointB)
    if (!first || !second) return { valid: false, error: Infinity, message: 'Missing point' }
    const error = Math.hypot(first.x - second.x, first.y - second.y)
    return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : 'Points are not connected' }
  }
  if (constraint.type === 'pointOnLine') {
    const point = resolvePoint(document, constraint.point); const line = segment(document, constraint.line)
    if (!point || !line) return { valid: false, error: Infinity, message: 'Missing point or line' }
    const start = resolvePoint(document, line.start); const end = resolvePoint(document, line.end)
    if (!start || !end) return { valid: false, error: Infinity, message: 'Missing line endpoint' }
    const cross = (point.x - start.x) * (end.y - start.y) - (point.y - start.y) * (end.x - start.x)
    const error = Math.abs(cross) / Math.max(1, Math.hypot(end.x - start.x, end.y - start.y))
    return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : 'Point is not on line' }
  }
  if (constraint.type === 'midpoint') {
    const point = resolvePoint(document, constraint.point); const line = segment(document, constraint.line)
    if (!point || !line) return { valid: false, error: Infinity, message: 'Missing midpoint or line' }
    const start = resolvePoint(document, line.start); const end = resolvePoint(document, line.end)
    if (!start || !end) return { valid: false, error: Infinity, message: 'Missing line endpoint' }
    const expected = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    const error = Math.hypot(point.x - expected.x, point.y - expected.y)
    return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : 'Point is not the midpoint' }
  }
  if (constraint.type === 'intersection') {
    const point = resolvePoint(document, constraint.point)
    const first = segment(document, constraint.lineA); const second = segment(document, constraint.lineB)
    if (!point || !first || !second) return { valid: false, error: Infinity, message: 'Missing intersection or line' }
    const expected = intersectSegments(document, first, second)
    if (!expected) return { valid: false, error: Infinity, message: 'Lines do not intersect within their ranges' }
    const error = Math.hypot(point.x - expected.x, point.y - expected.y)
    return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : 'Point is not at the intersection' }
  }
  if (constraint.type === 'fixedDistance') {
    const a = resolvePoint(document, constraint.a); const b = resolvePoint(document, constraint.b)
    if (!a || !b) return { valid: false, error: Infinity, message: 'Missing point' }
    const error = Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - constraint.value)
    return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : 'Distance constraint is not satisfied' }
  }
  if (constraint.type === 'fixedAngle') {
    const a = resolvePoint(document, constraint.a); const vertex = resolvePoint(document, constraint.vertex); const b = resolvePoint(document, constraint.b)
    if (!a || !vertex || !b) return { valid: false, error: Infinity, message: 'Missing point' }
    const normalized = Math.abs(angleBetweenPoints(a, vertex, b) - Math.abs(constraint.value))
    return { valid: normalized <= EPSILON, error: normalized, message: normalized <= EPSILON ? undefined : 'Angle constraint is not satisfied' }
  }
  if (constraint.type === 'horizontal' || constraint.type === 'vertical') {
    const direction = vector(document, constraint.segment)
    if (!direction) return { valid: false, error: Infinity, message: 'Missing segment' }
    const error = constraint.type === 'horizontal' ? Math.abs(direction.y) : Math.abs(direction.x)
    const message = constraint.type === 'horizontal' ? 'Segment is not horizontal' : 'Segment is not vertical'
    return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : message }
  }
  const first = vector(document, constraint.type === 'equalLength' ? constraint.segmentA : constraint.lineA)
  const second = vector(document, constraint.type === 'equalLength' ? constraint.segmentB : constraint.lineB)
  if (!first || !second) return { valid: false, error: Infinity, message: 'Missing segment' }
  const cross = Math.abs(first.x * second.y - first.y * second.x)
  const dot = first.x * second.x + first.y * second.y
  if (constraint.type === 'equalLength') {
    const error = Math.abs(length(first) - length(second))
    return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : 'Segments are not equal' }
  }
  const error = constraint.type === 'perpendicular' ? Math.abs(dot) : cross
  return { valid: error <= EPSILON, error, message: error <= EPSILON ? undefined : constraint.type === 'perpendicular' ? 'Lines are not perpendicular' : 'Lines are not parallel' }
}

export function evaluateConstraints(document: GeometryDocument, constraints: GeometryConstraint[]): ConstraintResult[] {
  return constraints.map((constraint) => evaluateConstraint(document, constraint))
}

export function addConstraint(document: GeometryDocument, constraint: GeometryConstraint): GeometryDocument {
  return { ...document, constraints: [...document.constraints, constraint] }
}

export function removeConstraint(document: GeometryDocument, index: number): GeometryDocument {
  return { ...document, constraints: document.constraints.filter((_constraint, current) => current !== index) }
}

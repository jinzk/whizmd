import type { GeometryDocument, GeometrySegment } from './model'
import { resolvePoint } from './calculations'

export type CyclePoint = { x: number; y: number }

function orientation(a: CyclePoint, b: CyclePoint, c: CyclePoint): number {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  return value > 1e-9 ? 1 : value < -1e-9 ? -1 : 0
}

function onSegment(a: CyclePoint, b: CyclePoint, p: CyclePoint): boolean {
  return p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9 && p.y >= Math.min(a.y, b.y) - 1e-9 && p.y <= Math.max(a.y, b.y) + 1e-9
}

export function segmentsProperlyIntersect(a1: CyclePoint, a2: CyclePoint, b1: CyclePoint, b2: CyclePoint): boolean {
  const d1 = orientation(a1, a2, b1)
  const d2 = orientation(a1, a2, b2)
  const d3 = orientation(b1, b2, a1)
  const d4 = orientation(b1, b2, a2)
  if (d1 !== d2 && d3 !== d4) return true
  if (d1 === 0 && onSegment(a1, a2, b1)) return true
  if (d2 === 0 && onSegment(a1, a2, b2)) return true
  if (d3 === 0 && onSegment(b1, b2, a1)) return true
  if (d4 === 0 && onSegment(b1, b2, a2)) return true
  return false
}

/** Finds a simple closed cycle through a point, ignoring extra edges attached to its vertices. */
export function findPolygonCycle(document: GeometryDocument, startPointId: string): string[] | null {
  const segments = document.segments
  if (!segments.length) return null
  const at = (id: string): GeometrySegment[] => segments.filter((segment) => segment.start === id || segment.end === id)
  const visit = (currentId: string, order: string[], used: Set<string>): string[] | null => {
    for (const segment of at(currentId)) {
      if (used.has(segment.id)) continue
      const nextId = segment.start === currentId ? segment.end : segment.start
      if (nextId === startPointId) return order.length >= 3 ? order : null
      if (order.includes(nextId)) continue
      const nextUsed = new Set(used).add(segment.id)
      const result = visit(nextId, [...order, nextId], nextUsed)
      if (result) return result
    }
    return null
  }
  return visit(startPointId, [startPointId], new Set())
}

export function polygonCycleSegmentIds(document: GeometryDocument, vertexIds: readonly string[]): string[] {
  const vertices = new Set(vertexIds)
  return document.segments
    .filter((object): object is GeometrySegment => object.type === 'segment' && vertices.has(object.start) && vertices.has(object.end))
    .filter((segment) => {
      const index = vertexIds.indexOf(segment.start)
      const next = vertexIds[(index + 1) % vertexIds.length]
      const previous = vertexIds[(index + vertexIds.length - 1) % vertexIds.length]
      return segment.end === next || segment.end === previous
    })
    .map((segment) => segment.id)
}

function polygonArea(document: GeometryDocument, vertexIds: readonly string[]): number {
  return Math.abs(vertexIds.reduce((sum, id, index) => {
    const point = resolvePoint(document, id)
    const next = resolvePoint(document, vertexIds[(index + 1) % vertexIds.length])
    return point && next ? sum + point.x * next.y - next.x * point.y : sum
  }, 0) / 2)
}

function containsPoint(document: GeometryDocument, vertexIds: readonly string[], point: CyclePoint): boolean {
  let inside = false
  for (let index = 0, previous = vertexIds.length - 1; index < vertexIds.length; previous = index++) {
    const current = resolvePoint(document, vertexIds[index])
    const prior = resolvePoint(document, vertexIds[previous])
    if (!current || !prior) continue
    const crosses = (current.y > point.y) !== (prior.y > point.y)
    if (crosses && point.x < ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) + current.x) inside = !inside
  }
  return inside
}

/** Returns the smallest simple polygon containing point, or null when the point is outside all cycles. */
export function findPolygonAtPoint(document: GeometryDocument, point: CyclePoint): string[] | null {
  const candidates: string[][] = []
  for (const object of document.points) {
    if (object.type !== 'point') continue
    const cycle = findPolygonCycle(document, object.id)
    if (!cycle || !isSimpleCycle(document, cycle) || !containsPoint(document, cycle, point)) continue
    if (!candidates.some((candidate) => candidate.length === cycle.length && candidate.every((id) => cycle.includes(id)))) candidates.push(cycle)
  }
  return candidates.sort((a, b) => polygonArea(document, a) - polygonArea(document, b))[0] ?? null
}

/** True when none of the cycle's non-adjacent edges cross each other. */
export function isSimpleCycle(document: GeometryDocument, vertexIds: string[]): boolean {
  if (vertexIds.length < 3) return true
  const points = vertexIds.map((id) => resolvePoint(document, id))
  if (points.some((point) => !point)) return true
  const count = points.length
  const isAdjacent = (i: number, j: number): boolean => {
    const diff = Math.abs(i - j)
    return diff === 1 || diff === count - 1
  }
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 2; j < count; j += 1) {
      if (isAdjacent(i, j)) continue
      const a1 = points[i]!; const a2 = points[(i + 1) % count]!
      const b1 = points[j]!; const b2 = points[(j + 1) % count]!
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) return false
    }
  }
  return true
}

/**
 * Returns the closed vertex cycle through startPointId when it forms a
 * constrained rigid shape (every cycle edge present, at least one edge tied
 * to a constraint — e.g. shapes created by the shape tool). Null otherwise,
 * so free polygons keep per-vertex reshape dragging.
 */
export function findConstrainedShapeCycle(document: GeometryDocument, startPointId: string): string[] | null {
  const explicitShape = document.shapes.find((shape) => shape.boundaryPointIds.includes(startPointId))
  if (explicitShape && explicitShape.boundaryPointIds.length >= 3 && explicitShape.boundarySegmentIds.length === explicitShape.boundaryPointIds.length) {
    return [...explicitShape.boundaryPointIds]
  }
  const startPoint = document.points.find((object) => object.id === startPointId)
  const owned = startPoint?.type === 'point' ? startPoint.ownerId : undefined
  if (owned) {
    const ownedSegments = document.segments.filter((object) => object.ownerId === owned && object.role === 'boundary')
    const atOwned = (id: string): GeometrySegment[] => ownedSegments.filter((segment) => segment.start === id || segment.end === id)
    const order = [startPointId]
    const used = new Set<string>()
    let current = startPointId
    while (true) {
      const nextSegment = atOwned(current).find((segment) => !used.has(segment.id))
      if (!nextSegment) break
      used.add(nextSegment.id)
      const next = nextSegment.start === current ? nextSegment.end : nextSegment.start
      if (next === startPointId) return order.length >= 3 ? order : null
      if (order.includes(next)) break
      order.push(next)
      current = next
    }
    return null
  }
  const segments = document.segments
  const at = (id: string): GeometrySegment[] => segments.filter((segment) => segment.start === id || segment.end === id)
  const candidates: string[][] = []
  const visit = (currentId: string, order: string[], used: Set<string>): void => {
    for (const segment of at(currentId)) {
      if (used.has(segment.id)) continue
      const nextId = segment.start === currentId ? segment.end : segment.start
      if (nextId === startPointId) {
        if (order.length >= 3 && isSimpleCycle(document, order)) candidates.push(order)
        continue
      }
      if (order.includes(nextId)) continue
      visit(nextId, [...order, nextId], new Set(used).add(segment.id))
    }
  }
  visit(startPointId, [startPointId], new Set())
  const scored = candidates.map((cycle) => {
    const ids = new Set(polygonCycleSegmentIds(document, cycle))
    const covered = [...ids].filter((id) => document.constraints.some((constraint) => Object.values(constraint).some((value) => value === id))).length
    return { cycle, covered, coverage: covered / ids.size }
  }).filter((candidate) => candidate.covered > 0)
  return scored.sort((a, b) => b.coverage - a.coverage || b.covered - a.covered || b.cycle.length - a.cycle.length)[0]?.cycle ?? null
}

/**
 * True when the cycle supports free corner stretching: exactly four vertices
 * with parallel/perpendicular edge constraints and no equal-length constraint.
 * Covers rectangles AND parallelograms (an axis-aligned affine stretch maps a
 * parallelogram onto a parallelogram, keeping both side pairs parallel).
 * Squares/rhombi carry equalLength constraints, so they scale uniformly.
 */
export function isAxisResizableRectangle(document: GeometryDocument, cycle: readonly string[]): boolean {
  if (cycle.length !== 4) return false
  const vertexSet = new Set(cycle)
  const cycleSegments = document.segments.filter((object) => vertexSet.has(object.start) && vertexSet.has(object.end))
  if (cycleSegments.length !== 4) return false
  const segmentIds = new Set(cycleSegments.map((segment) => segment.id))
  let directional = 0
  for (const constraint of document.constraints) {
    const referencesCycle = Object.values(constraint).some((value) => typeof value === 'string' && segmentIds.has(value))
    if (!referencesCycle) continue
    if (constraint.type === 'equalLength') return false
    if (constraint.type === 'parallel' || constraint.type === 'perpendicular') directional += 1
  }
  return directional >= 2
}

export type VertexAngleInfo = { prevId: string; nextId: string; angleDeg: number; sign: 1 | -1; editable: boolean }

/**
 * Interior-angle info for any polygon vertex on a closed cycle (free or
 * constrained). `editable` is false when a perpendicular constraint locks the
 * two edges meeting at this vertex (rectangle/square corners stay at 90°).
 */
export function getVertexAngle(document: GeometryDocument, pointId: string): VertexAngleInfo | null {
  const cycle = findPolygonCycle(document, pointId)
  if (!cycle || cycle.length < 3) return null
  const vertexSet = new Set(cycle)
  const cycleSegments = document.segments.filter((object) => vertexSet.has(object.start) && vertexSet.has(object.end))
  if (cycleSegments.length !== cycle.length) return null
  const index = cycle.indexOf(pointId)
  const resolve = (id: string) => {
    const point = document.points.find((object) => object.id === id)
    return point && point.type === 'point' ? point : null
  }
  const vertex = resolve(pointId)
  const prev = resolve(cycle[(index + cycle.length - 1) % cycle.length])
  const next = resolve(cycle[(index + 1) % cycle.length])
  if (!vertex || !prev || !next) return null
  const incidentEdges = cycleSegments.map((segment) => segment.id)
  // 环内只要存在任一垂直约束，四边形即为矩形族：全部内角锁定为 90°。
  const lockedByPerpendicular = document.constraints.some(
    (constraint) =>
      constraint.type === 'perpendicular' &&
      [constraint.lineA, constraint.lineB].every((line) => incidentEdges.includes(line))
  )
  const a1 = Math.atan2(prev.y - vertex.y, prev.x - vertex.x)
  const a2 = Math.atan2(next.y - vertex.y, next.x - vertex.x)
  let signed = a2 - a1
  while (signed > Math.PI) signed -= Math.PI * 2
  while (signed < -Math.PI) signed += Math.PI * 2
  if (Math.abs(signed) < 1e-9 || Math.abs(Math.abs(signed) - Math.PI) < 1e-9) return null
  return {
    prevId: prev.id,
    nextId: next.id,
    angleDeg: (Math.abs(signed) * 180) / Math.PI,
    sign: signed > 0 ? 1 : -1,
    editable: !lockedByPerpendicular
  }
}

/** Back-compat helper: angle info restricted to editable vertices. */
export function getEditableVertexAngle(document: GeometryDocument, pointId: string): VertexAngleInfo | null {
  const info = getVertexAngle(document, pointId)
  return info?.editable ? info : null
}

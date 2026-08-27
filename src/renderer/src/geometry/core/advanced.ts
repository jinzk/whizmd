import { addCircle, addPoint, addSegment, getGeometryObject, type GeometryDocument } from './model'
import { resolvePoint } from './calculations'

function mirrorPoint(point: { x: number; y: number }, axisA: { x: number; y: number }, axisB: { x: number; y: number }): { x: number; y: number } {
  const dx = axisB.x - axisA.x; const dy = axisB.y - axisA.y
  const lengthSquared = dx * dx + dy * dy
  if (!lengthSquared) return point
  const projection = ((point.x - axisA.x) * dx + (point.y - axisA.y) * dy) / lengthSquared
  const projected = { x: axisA.x + projection * dx, y: axisA.y + projection * dy }
  return { x: 2 * projected.x - point.x, y: 2 * projected.y - point.y }
}

export function mirrorObjects(document: GeometryDocument, objectIds: readonly string[], axisA: { x: number; y: number }, axisB: { x: number; y: number }): GeometryDocument {
  let next = document
  const pointMap = new Map<string, string>()
  const selected = new Set(objectIds)
  for (const object of [...document.points, ...document.segments, ...document.curves]) {
    if (object.type !== 'point' || !selected.has(object.id)) continue
    const mirrored = mirrorPoint(object, axisA, axisB)
    const point = addPoint(next, mirrored.x, mirrored.y)
    const newId = point.points.at(-1)!.id
    next = point
    pointMap.set(object.id, newId)
  }
  for (const object of document.segments) {
    if (object.type !== 'segment' || !selected.has(object.id)) continue
    const start = pointMap.get(object.start); const end = pointMap.get(object.end)
    if (start && end) next = addSegment(next, start, end)
  }
  for (const object of document.curves) {
    if (object.type !== 'circle' || !selected.has(object.id)) continue
    const center = pointMap.get(object.center)
    if (center) next = addCircle(next, center, object.radius)
  }
  return next
}

export function offsetSegment(document: GeometryDocument, segmentId: string, distance: number): GeometryDocument {
  const segment = getGeometryObject(document, segmentId)
  if (!segment || segment.type !== 'segment' || !Number.isFinite(distance) || distance === 0) return document
  const start = resolvePoint(document, segment.start); const end = resolvePoint(document, segment.end)
  if (!start || !end) return document
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  if (!length) return document
  const nx = -(end.y - start.y) / length * distance; const ny = (end.x - start.x) / length * distance
  let next = addPoint(document, start.x + nx, start.y + ny)
  const first = next.points.at(-1)!.id
  next = addPoint(next, end.x + nx, end.y + ny)
  return addSegment(next, first, next.points.at(-1)!.id)
}

export function offsetCircle(document: GeometryDocument, circleId: string, distance: number): GeometryDocument {
  const circle = getGeometryObject(document, circleId)
  return circle?.type === 'circle' && Number.isFinite(distance) && distance !== 0 ? addCircle(document, circle.center, Math.max(1, circle.radius + distance)) : document
}

export function trimSegmentAt(document: GeometryDocument, segmentId: string, parameter: number): GeometryDocument {
  const segment = document.segments.find((object) => object.id === segmentId)
  if (!segment || segment.type !== 'segment' || !Number.isFinite(parameter) || parameter <= 0 || parameter >= 1) return document
  const start = resolvePoint(document, segment.start); const end = resolvePoint(document, segment.end)
  if (!start || !end) return document
  const point = addPoint(document, start.x + (end.x - start.x) * parameter, start.y + (end.y - start.y) * parameter)
  const pointId = point.points.at(-1)!.id
  const segments = point.segments.filter((object) => object.id !== segmentId)
  return addSegment({ ...point, segments }, segment.start, pointId)
}

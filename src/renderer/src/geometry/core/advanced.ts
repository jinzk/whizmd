import { addCircle, addPoint, addSegment, type GeometryDocument } from './model'

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

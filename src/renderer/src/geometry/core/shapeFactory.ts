import type { GeometryDocument } from './model'
import { addCircle, addPoint, addSegment, addShape, nextObjectId, type GeometryShapeKind } from './model'
import { addConstraint } from './constraints'

export type ShapeKind = GeometryShapeKind

export function buildShape(document: GeometryDocument, kind: ShapeKind, x1: number, y1: number, x2: number, y2: number): GeometryDocument {
  let next = document
  const ownerId = `shape-${nextObjectId(document, 'R')}`
  const ids: string[] = []
  const put = (x: number, y: number): void => {
    next = addPoint(next, x, y, `P${next.points.length + 1}`, { ownerId, role: 'boundary' })
    ids.push(next.points.at(-1)!.id)
  }
  const link = (a: string, b: string): string => {
    next = addSegment(next, a, b, { ownerId, role: 'boundary' })
    return next.segments.at(-1)!.id
  }
  const constrain = (constraint: Parameters<typeof addConstraint>[1]): void => {
    next = addConstraint(next, constraint)
  }
  if (kind === 'circle') {
    const radius = Math.max(1, Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2)
    put((x1 + x2) / 2, (y1 + y2) / 2)
    return addShape(addCircle(next, ids[0], radius), { id: ownerId, kind, boundaryPointIds: ids, boundarySegmentIds: [] })
  }
  if (kind === 'square' || kind === 'rectangle') {
    const width = Math.abs(x2 - x1)
    const height = Math.abs(y2 - y1)
    if (kind === 'square') {
      const side = Math.max(width, height)
      x2 = x1 + Math.sign(x2 - x1 || 1) * side
      y2 = y1 + Math.sign(y2 - y1 || 1) * side
    }
    ;[[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      const ex = sx === -1 ? x1 : x2
      const ey = sy === -1 ? y1 : y2
      put(ex, ey)
    })
    const sides = [link(ids[0], ids[1]), link(ids[1], ids[2]), link(ids[2], ids[3]), link(ids[3], ids[0])]
    constrain({ type: 'perpendicular', lineA: sides[0], lineB: sides[1] })
    constrain({ type: 'parallel', lineA: sides[0], lineB: sides[2] })
    constrain({ type: 'parallel', lineA: sides[1], lineB: sides[3] })
    if (kind === 'square') constrain({ type: 'equalLength', segmentA: sides[0], segmentB: sides[1] })
    return addShape(next, { id: ownerId, kind, boundaryPointIds: ids, boundarySegmentIds: sides })
  }
  if (kind === 'parallelogram') {
    const leftX = Math.min(x1, x2)
    const rightX = Math.max(x1, x2)
    const topY = Math.min(y1, y2)
    const bottomY = Math.max(y1, y2)
    const offset = (rightX - leftX) * 0.25
    put(leftX, bottomY)
    put(rightX, bottomY)
    put(rightX + offset, topY)
    put(leftX + offset, topY)
    const sides = [link(ids[0], ids[1]), link(ids[1], ids[2]), link(ids[2], ids[3]), link(ids[3], ids[0])]
    constrain({ type: 'parallel', lineA: sides[0], lineB: sides[2] })
    constrain({ type: 'parallel', lineA: sides[1], lineB: sides[3] })
    return addShape(next, { id: ownerId, kind, boundaryPointIds: ids, boundarySegmentIds: sides })
  }
  if (kind === 'rhombus') {
    const centerX = (x1 + x2) / 2
    const centerY = (y1 + y2) / 2
    const halfWidth = Math.max(10, Math.abs(x2 - x1) / 2)
    const halfHeight = Math.max(10, Math.abs(y2 - y1) / 2)
    put(centerX, centerY - halfHeight)
    put(centerX + halfWidth, centerY)
    put(centerX, centerY + halfHeight)
    put(centerX - halfWidth, centerY)
    const sides = [link(ids[0], ids[1]), link(ids[1], ids[2]), link(ids[2], ids[3]), link(ids[3], ids[0])]
    constrain({ type: 'equalLength', segmentA: sides[0], segmentB: sides[1] })
    constrain({ type: 'equalLength', segmentA: sides[1], segmentB: sides[2] })
    constrain({ type: 'equalLength', segmentA: sides[2], segmentB: sides[3] })
    return addShape(next, { id: ownerId, kind, boundaryPointIds: ids, boundarySegmentIds: sides })
  }
  const baseLength = Math.abs(x2 - x1)
  const leftX = Math.min(x1, x2)
  const rightX = Math.max(x1, x2)
  const baseY = y1
  const directionDown = y2 > y1
  put(leftX, baseY)
  put(rightX, baseY)
  link(ids[0], ids[1])
  if (kind === 'equilateral') {
    const height = (Math.sqrt(3) / 2) * baseLength
    const apexY = baseY + (directionDown ? height : -height)
    put((leftX + rightX) / 2, apexY)
  } else {
    const apexY = y2
    put((leftX + rightX) / 2, apexY)
  }
  const leftLeg = link(ids[0], ids[2])
  const rightLeg = link(ids[1], ids[2])
  constrain({ type: 'equalLength', segmentA: leftLeg, segmentB: rightLeg })
  const boundarySegmentIds = next.segments.filter((object) => object.ownerId === ownerId).map((object) => object.id)
  return addShape(next, { id: ownerId, kind, boundaryPointIds: ids, boundarySegmentIds })
}

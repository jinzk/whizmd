import type { GeometryDocument } from './model'
import { movePoint } from './model'
import { resolvePoint } from './calculations'

export function transformVertices(document: GeometryDocument, vertexIds: readonly string[], transform: (x: number, y: number) => { x: number; y: number }): GeometryDocument {
  let next = document
  for (const vertexId of vertexIds) {
    const point = resolvePoint(document, vertexId)
    if (!point) continue
    const moved = transform(point.x, point.y)
    next = movePoint(next, vertexId, moved.x, moved.y)
  }
  return next
}

export function scaleAboutAnchor(document: GeometryDocument, vertexIds: readonly string[], anchor: { x: number; y: number }, factor: number): GeometryDocument {
  return transformVertices(document, vertexIds, (x, y) => ({ x: anchor.x + (x - anchor.x) * factor, y: anchor.y + (y - anchor.y) * factor }))
}

export function stretchAboutAnchor(document: GeometryDocument, vertexIds: readonly string[], anchor: { x: number; y: number }, factorX: number, factorY: number): GeometryDocument {
  return transformVertices(document, vertexIds, (x, y) => ({ x: anchor.x + (x - anchor.x) * factorX, y: anchor.y + (y - anchor.y) * factorY }))
}

export function rotateAboutPivot(document: GeometryDocument, vertexIds: readonly string[], pivot: { x: number; y: number }, angle: number): GeometryDocument {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return transformVertices(document, vertexIds, (x, y) => {
    const vx = x - pivot.x
    const vy = y - pivot.y
    return { x: pivot.x + vx * cos - vy * sin, y: pivot.y + vx * sin + vy * cos }
  })
}

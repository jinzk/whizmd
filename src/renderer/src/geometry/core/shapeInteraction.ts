import type { GeometryShapeKind } from './model'

export type ShapeDragMode = 'rotate' | 'uniformScale' | 'freeStretch'

export type ShapeInteraction = {
  vertexDrag: ShapeDragMode
  edgeDrag: ShapeDragMode
}

export const SHAPE_INTERACTIONS: Record<GeometryShapeKind, ShapeInteraction> = {
  circle: { vertexDrag: 'rotate', edgeDrag: 'uniformScale' },
  ellipse: { vertexDrag: 'rotate', edgeDrag: 'freeStretch' },
  square: { vertexDrag: 'rotate', edgeDrag: 'uniformScale' },
  rectangle: { vertexDrag: 'rotate', edgeDrag: 'freeStretch' },
  parallelogram: { vertexDrag: 'rotate', edgeDrag: 'freeStretch' },
  rhombus: { vertexDrag: 'rotate', edgeDrag: 'uniformScale' },
  equilateral: { vertexDrag: 'rotate', edgeDrag: 'uniformScale' },
  isosceles: { vertexDrag: 'rotate', edgeDrag: 'uniformScale' },
  rightTriangle: { vertexDrag: 'rotate', edgeDrag: 'freeStretch' }
}

export function getShapeInteraction(kind: GeometryShapeKind): ShapeInteraction {
  return SHAPE_INTERACTIONS[kind]
}

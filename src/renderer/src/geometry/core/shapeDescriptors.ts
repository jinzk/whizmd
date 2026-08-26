import type { ShapeKind } from './shapeFactory'

export type ShapeDescriptor = {
  kind: ShapeKind
  vertexCount: number
  supportsUniformScale: boolean
  supportsFreeStretch: boolean
  supportsRotation: boolean
  supportsInteriorAngleEditing: boolean
}

export const SHAPE_DESCRIPTORS: readonly ShapeDescriptor[] = [
  { kind: 'circle', vertexCount: 1, supportsUniformScale: false, supportsFreeStretch: false, supportsRotation: false, supportsInteriorAngleEditing: false },
  { kind: 'ellipse', vertexCount: 2, supportsUniformScale: false, supportsFreeStretch: true, supportsRotation: true, supportsInteriorAngleEditing: false },
  { kind: 'square', vertexCount: 4, supportsUniformScale: true, supportsFreeStretch: false, supportsRotation: true, supportsInteriorAngleEditing: false },
  { kind: 'rectangle', vertexCount: 4, supportsUniformScale: false, supportsFreeStretch: true, supportsRotation: true, supportsInteriorAngleEditing: false },
  { kind: 'parallelogram', vertexCount: 4, supportsUniformScale: false, supportsFreeStretch: true, supportsRotation: true, supportsInteriorAngleEditing: true },
  { kind: 'rhombus', vertexCount: 4, supportsUniformScale: true, supportsFreeStretch: false, supportsRotation: true, supportsInteriorAngleEditing: true },
  { kind: 'equilateral', vertexCount: 3, supportsUniformScale: true, supportsFreeStretch: false, supportsRotation: true, supportsInteriorAngleEditing: true },
  { kind: 'isosceles', vertexCount: 3, supportsUniformScale: true, supportsFreeStretch: false, supportsRotation: true, supportsInteriorAngleEditing: true }
]

export function getShapeDescriptor(kind: ShapeKind): ShapeDescriptor {
  return SHAPE_DESCRIPTORS.find((descriptor) => descriptor.kind === kind) ?? SHAPE_DESCRIPTORS[0]
}

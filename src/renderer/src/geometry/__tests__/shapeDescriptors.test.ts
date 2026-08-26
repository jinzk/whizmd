import { describe, expect, it } from 'vitest'
import { getShapeDescriptor, SHAPE_DESCRIPTORS } from '../index'

describe('shape descriptors', () => {
  it('describes every factory shape exactly once', () => {
    const kinds = SHAPE_DESCRIPTORS.map((descriptor) => descriptor.kind)
    expect(new Set(kinds).size).toBe(kinds.length)
    expect(kinds).toEqual(['circle', 'ellipse', 'square', 'rectangle', 'parallelogram', 'rhombus', 'equilateral', 'isosceles'])
  })

  it('centralizes transform capabilities', () => {
    expect(getShapeDescriptor('square')).toMatchObject({ supportsUniformScale: true, supportsFreeStretch: false })
    expect(getShapeDescriptor('rectangle')).toMatchObject({ supportsUniformScale: false, supportsFreeStretch: true })
    expect(getShapeDescriptor('parallelogram')).toMatchObject({ supportsFreeStretch: true, supportsInteriorAngleEditing: true })
    expect(getShapeDescriptor('rhombus')).toMatchObject({ supportsUniformScale: true, supportsInteriorAngleEditing: true })
  })
})

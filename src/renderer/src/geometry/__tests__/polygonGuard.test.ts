import { describe, expect, it } from 'vitest'
import { addConstraint, addPoint, addSegment, buildShape, createGeometryDocument, findConstrainedShapeCycle, findPolygonCycle, getEditableVertexAngle, isAxisResizableRectangle, isSimpleCycle } from '../index'

function square() {
  let document = createGeometryDocument()
  document = addPoint(document, 0, 0); document = addPoint(document, 200, 0)
  document = addPoint(document, 200, 200); document = addPoint(document, 0, 200)
  document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P2', 'P3')
  document = addSegment(document, 'P3', 'P4'); document = addSegment(document, 'P4', 'P1')
  return document
}

describe('polygon self-crossing guard', () => {
  it('walks a closed cycle from any of its vertices', () => {
    const document = square()
    const fromP2 = findPolygonCycle(document, 'P2')
    const fromP4 = findPolygonCycle(document, 'P4')
    expect(fromP2).not.toBeNull()
    expect([...fromP2!].sort()).toEqual(['P1', 'P2', 'P3', 'P4'])
    expect([...fromP4!].sort()).toEqual(['P1', 'P2', 'P3', 'P4'])
  })

  it('returns null for open chains and branched nodes', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 20, 5)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P2', 'P3')
    expect(findPolygonCycle(document, 'P1')).toBeNull()
    let branched = createGeometryDocument()
    branched = addPoint(branched, 0, 0); branched = addPoint(branched, 10, 0); branched = addPoint(branched, 20, 0); branched = addPoint(branched, 10, 10)
    branched = addSegment(branched, 'P1', 'P2'); branched = addSegment(branched, 'P2', 'P3'); branched = addSegment(branched, 'P2', 'P4')
    expect(findPolygonCycle(branched, 'P1')).toBeNull()
  })

  it('accepts a simple square and rejects a bowtie', () => {
    const squareDoc = square()
    expect(isSimpleCycle(squareDoc, ['P1', 'P2', 'P3', 'P4'])).toBe(true)
    let bowtie = createGeometryDocument()
    bowtie = addPoint(bowtie, 0, 0); bowtie = addPoint(bowtie, 200, 200)
    bowtie = addPoint(bowtie, 200, 0); bowtie = addPoint(bowtie, 0, 200)
    bowtie = addSegment(bowtie, 'P1', 'P2'); bowtie = addSegment(bowtie, 'P2', 'P3')
    bowtie = addSegment(bowtie, 'P3', 'P4'); bowtie = addSegment(bowtie, 'P4', 'P1')
    expect(isSimpleCycle(bowtie, ['P1', 'P2', 'P3', 'P4'])).toBe(false)
  })

  it('treats shape-tool cycles as scalable but leaves free polygons alone', () => {
    const shaped = buildShape(createGeometryDocument(), 'square', 0, 0, 100, 100)
    expect([...findConstrainedShapeCycle(shaped, 'P1')!].sort()).toEqual(['P1', 'P2', 'P3', 'P4'])
    let free = square()
    expect(findConstrainedShapeCycle(free, 'P1')).toBeNull()
    free = addConstraint(free, { type: 'equalLength', segmentA: 'S1', segmentB: 'S2' })
    expect(findConstrainedShapeCycle(free, 'P3')).not.toBeNull()
    let triangle = addPoint(createGeometryDocument(), 0, 0); triangle = addPoint(triangle, 100, 0); triangle = addPoint(triangle, 50, 80)
    triangle = addSegment(triangle, 'P1', 'P2'); triangle = addSegment(triangle, 'P2', 'P3'); triangle = addSegment(triangle, 'P3', 'P1')
    expect(findConstrainedShapeCycle(triangle, 'P2')).toBeNull()
  })

  it('distinguishes free-stretch rectangles from uniformly scaling squares', () => {
    const rectangle = buildShape(createGeometryDocument(), 'rectangle', 0, 0, 200, 100)
    const square = buildShape(createGeometryDocument(), 'square', 400, 0, 500, 100)
    expect(isAxisResizableRectangle(rectangle, ['P1', 'P2', 'P3', 'P4'])).toBe(true)
    expect(isAxisResizableRectangle(square, ['P1', 'P2', 'P3', 'P4'])).toBe(false)
    const parallelogram = buildShape(createGeometryDocument(), 'parallelogram', 600, 0, 800, 100)
    expect(isAxisResizableRectangle(parallelogram, ['P1', 'P2', 'P3', 'P4'])).toBe(true)
    const rhombus = buildShape(createGeometryDocument(), 'rhombus', 900, 0, 1100, 160)
    expect(isAxisResizableRectangle(rhombus, ['P1', 'P2', 'P3', 'P4'])).toBe(false)
  })

  it('exposes editable interior angles for parallelograms and rhombi but not rectangles', () => {
    const parallelogram = buildShape(createGeometryDocument(), 'parallelogram', 0, 200, 300, 100)
    const acuteCorner = getEditableVertexAngle(parallelogram, 'P1')
    expect(acuteCorner).not.toBeNull()
    if (!acuteCorner) return
    expect(acuteCorner.angleDeg).toBeCloseTo(53.13010235415598, 5)
    const obtuseCorner = getEditableVertexAngle(parallelogram, 'P2')
    expect(obtuseCorner).not.toBeNull()
    if (!obtuseCorner) return
    expect(obtuseCorner.angleDeg).toBeCloseTo(180 - 53.13010235415598, 5)
    expect(obtuseCorner.angleDeg).toBeGreaterThan(90)
    const rectangle = buildShape(createGeometryDocument(), 'rectangle', 0, 0, 200, 100)
    expect(getEditableVertexAngle(rectangle, 'P1')).toBeNull()
    const rhombus = buildShape(createGeometryDocument(), 'rhombus', 500, 100, 700, 260)
    const rhombusAngle = getEditableVertexAngle(rhombus, 'P1')
    expect(rhombusAngle).not.toBeNull()
    if (!rhombusAngle) return
    expect(rhombusAngle.angleDeg).toBeGreaterThan(0)
    expect(rhombusAngle.angleDeg).toBeLessThan(180)
  })
})

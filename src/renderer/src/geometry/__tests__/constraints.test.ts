import { describe, expect, it } from 'vitest'
import { addCircle, addPoint, addSegment, angleBetweenPoints, createGeometryDocument } from '../index'
import { constraintPriority, evaluateConstraint, removeConstraint } from '../core/constraints'

describe('geometry constraints', () => {
  it('orders topology before shape and dependent constraints', () => {
    expect(constraintPriority({ type: 'coincident', pointA: 'P1', pointB: 'P2' })).toBe(0)
    expect(constraintPriority({ type: 'perpendicular', lineA: 'S1', lineB: 'S2' })).toBe(1)
    expect(constraintPriority({ type: 'intersection', point: 'P3', lineA: 'S1', lineB: 'S2' })).toBe(3)
  })
  it('uses an unsigned angle independent of arm order', () => {
    expect(angleBetweenPoints({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2)
    expect(angleBetweenPoints({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(Math.PI / 2)
  })
  it('evaluates connected endpoints', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 0, 0.0000001)
    expect(evaluateConstraint(document, { type: 'coincident', pointA: 'P1', pointB: 'P2' }).valid).toBe(true)
  })
  it('evaluates point-on-line, perpendicular, and parallel constraints', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 5, 0); document = addPoint(document, 5, 10)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P3', 'P4')
    expect(evaluateConstraint(document, { type: 'pointOnLine', point: 'P3', line: 'S1' }).valid).toBe(true)
    expect(evaluateConstraint(document, { type: 'perpendicular', lineA: 'S1', lineB: 'S2' }).valid).toBe(true)
  })

  it('evaluates horizontal and vertical constraints', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0)
    document = addSegment(document, 'P1', 'P2')
    expect(evaluateConstraint(document, { type: 'horizontal', segment: 'S1' }).valid).toBe(true)
    expect(evaluateConstraint(document, { type: 'vertical', segment: 'S1' }).valid).toBe(false)
  })

  it('evaluates tangency between a line and circles', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 100, 100)
    document = addCircle(document, 'P1', 40)
    document = addPoint(document, 0, 60); document = addPoint(document, 200, 60)
    document = addSegment(document, 'P2', 'P3')
    document = addPoint(document, 160, 100)
    document = addCircle(document, 'P4', 20)
    expect(evaluateConstraint(document, { type: 'tangent', curveA: 'C1', curveB: 'S1' }).valid).toBe(true)
    expect(evaluateConstraint(document, { type: 'tangent', curveA: 'C1', curveB: 'C2' }).valid).toBe(true)
    const moved = { ...document, points: document.points.map((object) => object.id === 'P3' ? { ...object, y: 50 } : object) }
    expect(evaluateConstraint(moved, { type: 'tangent', curveA: 'C1', curveB: 'S1' }).valid).toBe(false)
  })

  it('evaluates point symmetry about an axis segment', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 150, 150); document = addPoint(document, 250, 150)
    document = addPoint(document, 200, 100); document = addPoint(document, 200, 300)
    document = addSegment(document, 'P3', 'P4')
    expect(evaluateConstraint(document, { type: 'symmetric', a: 'P1', b: 'P2', mirror: 'S1' }).valid).toBe(true)
    const moved = { ...document, points: document.points.map((object) => object.id === 'P2' ? { ...object, x: 280 } : object) }
    expect(evaluateConstraint(moved, { type: 'symmetric', a: 'P1', b: 'P2', mirror: 'S1' }).valid).toBe(false)
  })

  it('reports unsatisfied equal length and distance constraints', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 3, 0)
    document = addPoint(document, 0, 4); document = addPoint(document, 0, 0)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P3', 'P4')
    expect(evaluateConstraint(document, { type: 'equalLength', segmentA: 'S1', segmentB: 'S2' }).valid).toBe(false)
    expect(evaluateConstraint(document, { type: 'fixedDistance', a: 'P1', b: 'P2', value: 4 }).valid).toBe(false)
  })

  it('removes a constraint without changing geometry objects', () => {
    let document = createGeometryDocument()
    document = { ...document, constraints: [{ type: 'parallel', lineA: 'S1', lineB: 'S2' }, { type: 'perpendicular', lineA: 'S1', lineB: 'S3' }] }
    const result = removeConstraint(document, 0)
    expect(result.constraints).toEqual([{ type: 'perpendicular', lineA: 'S1', lineB: 'S3' }])
    expect(result.points).toEqual(document.points)
    expect(result.segments).toEqual(document.segments)
  })
})

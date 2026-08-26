import { describe, expect, it } from 'vitest'
import { addCircle, addPoint, addSegment, createGeometryDocument, solveGeometry } from '../index'
import { buildShape } from '../core/shapeFactory'
import type { GeometryDocument } from '../index'

function shapePoints(document: GeometryDocument, ids: string[]): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {}
  for (const id of ids) {
    const point = document.objects.find((object) => object.type === 'point' && object.id === id)
    if (point && point.type === 'point') result[id] = { x: point.x, y: point.y }
  }
  return result
}

describe('geometry solver', () => {
  it('solves a fixed distance constraint within a bounded iteration count', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 2, 0)
    const result = solveGeometry(document, [{ type: 'fixedDistance', a: 'P1', b: 'P2', value: 10 }])
    expect(result.iterations).toBeLessThanOrEqual(12)
    expect(['solved', 'partial']).toContain(result.status)
    expect(result.residual).toBeLessThan(0.01)
  })

  it('handles a combined fixed-distance and equal-length system', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 2, 0); document = addPoint(document, 0, 3); document = addPoint(document, 4, 3)
    document = { ...document, objects: [...document.objects, { type: 'segment', id: 'S1', start: 'P1', end: 'P2' }, { type: 'segment', id: 'S2', start: 'P3', end: 'P4' }] }
    const result = solveGeometry(document, [{ type: 'fixedDistance', a: 'P1', b: 'P2', value: 4 }, { type: 'equalLength', segmentA: 'S1', segmentB: 'S2' }])
    expect(result.iterations).toBeLessThanOrEqual(12)
    expect(['solved', 'partial']).toContain(result.status)
  })

  it('adjusts the second segment when creating a parallel constraint', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0)
    document = addPoint(document, 0, 20); document = addPoint(document, 8, 24)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P3', 'P4')
    const result = solveGeometry(document, [{ type: 'parallel', lineA: 'S1', lineB: 'S2' }])
    expect(result.status).toBe('solved')
    const end = result.document.objects.find((object) => object.id === 'P4')
    expect(end && end.type === 'point' ? end.y : Infinity).toBe(20)
    expect(end && end.type === 'point' ? end.x : Infinity).toBeCloseTo(8.9442719)
  })

  it('connects the second endpoint to the first endpoint', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 10, 20); document = addPoint(document, 80, 90)
    const result = solveGeometry(document, [{ type: 'coincident', pointA: 'P1', pointB: 'P2' }])
    expect(result.status).toBe('solved')
    expect(result.document.objects.find((object) => object.id === 'P2')).toMatchObject({ x: 10, y: 20 })
  })

  it('keeps a parameterized point on the line when an endpoint moves', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 5, 0)
    document = addSegment(document, 'P1', 'P2')
    const result = solveGeometry(document, [{ type: 'pointOnLine', point: 'P3', line: 'S1', t: 0.5 }], 12, 'P1')
    expect(result.status).toBe('solved')
    const attached = result.document.objects.find((object) => object.id === 'P3')
    expect(attached && attached.type === 'point' ? Math.hypot(attached.x - 0.5 * (0 + 10), attached.y - 0) : Infinity).toBeLessThan(0.001)
  })

  it('snaps a dragged attached point back onto its line', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 5, 3)
    document = addSegment(document, 'P1', 'P2')
    const result = solveGeometry(document, [{ type: 'pointOnLine', point: 'P3', line: 'S1' }], 12, 'P3')
    expect(result.status).toBe('solved')
    expect(result.document.objects.find((object) => object.id === 'P3')).toMatchObject({ x: 5, y: 0 })
  })

  it('straightens a tilted segment with a horizontal constraint', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 6)
    document = addSegment(document, 'P1', 'P2')
    const result = solveGeometry(document, [{ type: 'horizontal', segment: 'S1' }])
    expect(result.status).toBe('solved')
    expect(result.document.objects.find((object) => object.id === 'P2')).toMatchObject({ x: 10, y: 0 })
  })

  it('reflects a point across the mirror axis for a symmetric constraint', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 150, 150); document = addPoint(document, 280, 150)
    document = addPoint(document, 200, 100); document = addPoint(document, 200, 300)
    document = addSegment(document, 'P3', 'P4')
    const result = solveGeometry(document, [{ type: 'symmetric', a: 'P1', b: 'P2', mirror: 'S1' }])
    expect(result.status).toBe('solved')
    expect(result.document.objects.find((object) => object.id === 'P2')).toMatchObject({ x: 250, y: 150 })
  })

  it('keeps both segment lengths while dragging a chained parallel endpoint', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 20, 0)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P2', 'P3')
    document = { ...document, constraints: [{ type: 'parallel', lineA: 'S1', lineB: 'S2' }] }
    document = { ...document, objects: document.objects.map((object) => object.type === 'point' && object.id === 'P3' ? { ...object, x: 26, y: 8 } : object) }
    const result = solveGeometry(document, document.constraints, 12, 'P3')
    expect(result.status).toBe('solved')
    const p1 = result.document.objects.find((object) => object.id === 'P1')
    const p2 = result.document.objects.find((object) => object.id === 'P2')
    const p3 = result.document.objects.find((object) => object.id === 'P3')
    expect(p2).toMatchObject({ x: 10, y: 0 })
    expect(p3).toMatchObject({ x: 26, y: 8 })
    if (!p1 || !p2 || !p3 || p1.type !== 'point' || p2.type !== 'point' || p3.type !== 'point') return
    expect(Math.hypot(p2.x - p1.x, p2.y - p1.y)).toBeCloseTo(10, 5)
    expect((p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x)).toBeCloseTo(0, 5)
  })

  it('rotates the partner segment rigidly when dragging the shared node', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 20, 0)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P2', 'P3')
    document = { ...document, constraints: [{ type: 'parallel', lineA: 'S1', lineB: 'S2' }] }
    document = { ...document, objects: document.objects.map((object) => object.type === 'point' && object.id === 'P2' ? { ...object, x: 10, y: 10 } : object) }
    const result = solveGeometry(document, document.constraints, 12, 'P2')
    expect(result.status).toBe('solved')
    expect(result.document.objects.find((object) => object.id === 'P2')).toMatchObject({ x: 10, y: 10 })
    expect(result.document.objects.find((object) => object.id === 'P3')).toMatchObject({ x: 20, y: 0 })
    const p1 = result.document.objects.find((object) => object.id === 'P1')
    expect(p1).toMatchObject({ x: 0, y: 20 })
  })

  it('preserves an anti-parallel orientation when creating a parallel constraint', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0)
    document = addPoint(document, 30, 0); document = addPoint(document, 20, 0)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P3', 'P4')
    const result = solveGeometry(document, [{ type: 'parallel', lineA: 'S1', lineB: 'S2' }])
    expect(result.status).toBe('solved')
    expect(result.document.objects.find((object) => object.id === 'P3')).toMatchObject({ x: 30, y: 0 })
    expect(result.document.objects.find((object) => object.id === 'P4')).toMatchObject({ x: 20, y: 0 })
  })

  it('drives a line to tangency with a circle through deterministic solving', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 100, 100)
    document = addCircle(document, 'P1', 40)
    document = addPoint(document, 300, 40); document = addPoint(document, 400, 40)
    document = addSegment(document, 'P2', 'P3')
    const result = solveGeometry(document, [{ type: 'tangent', curveA: 'C1', curveB: 'S1' }])
    expect(result.status).toBe('solved')
    expect(result.document.objects.find((object) => object.id === 'P2')).toMatchObject({ y: 60 })
    expect(result.document.objects.find((object) => object.id === 'P3')).toMatchObject({ y: 60 })
  })

  it('rotates the unlocked arm to satisfy a fixed angle constraint', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 20, 0)
    const result = solveGeometry(document, [{ type: 'fixedAngle', a: 'P1', vertex: 'P2', b: 'P3', value: -Math.PI / 4 }])
    expect(result.status).toBe('solved')
    const p3 = result.document.objects.find((object) => object.id === 'P3')
    if (!p3 || p3.type !== 'point') return
    expect(Math.hypot(p3.x - 10, p3.y - 0)).toBeCloseTo(10, 5)
    const angle = Math.atan2(p3.y - 0, p3.x - 10) - Math.atan2(0 - 0, 0 - 10)
    expect(Math.abs(angle)).toBeCloseTo(Math.PI / 4, 5)
  })

  it('keeps a dragged endpoint fixed while the constrained segment follows', () => {    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0)
    document = addPoint(document, 0, 20); document = addPoint(document, 8, 24)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P3', 'P4')
    document = { ...document, constraints: [{ type: 'parallel', lineA: 'S1', lineB: 'S2' }] }
    document = { ...document, objects: document.objects.map((object) => object.type === 'point' && object.id === 'P1' ? { ...object, x: 0, y: 10 } : object) }
    const result = solveGeometry(document, document.constraints, 12, 'P1')
    expect(result.status).toBe('solved')
    expect(result.document.objects.find((object) => object.id === 'P1')).toMatchObject({ x: 0, y: 10 })
    const referenceStart = result.document.objects.find((object) => object.id === 'P1')
    const start = result.document.objects.find((object) => object.id === 'P3')
    const end = result.document.objects.find((object) => object.id === 'P4')
    const referenceEnd = result.document.objects.find((object) => object.id === 'P2')
    expect(referenceStart && referenceStart.type === 'point' && referenceEnd && referenceEnd.type === 'point' && start && start.type === 'point' && end && end.type === 'point' ? (end.x - start.x) * (referenceEnd.y - referenceStart.y) - (end.y - start.y) * (referenceEnd.x - referenceStart.x) : Infinity).toBeCloseTo(0)
  })

  it('equalizes lengths without rotating the adjusted segment direction', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 0, 100)
    document = addPoint(document, 10, 10); document = addPoint(document, 50, 10)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P3', 'P4')
    const result = solveGeometry(document, [{ type: 'equalLength', segmentA: 'S1', segmentB: 'S2' }])
    expect(result.status).toBe('solved')
    const p4 = result.document.objects.find((object) => object.id === 'P4')
    if (!p4 || p4.type !== 'point') return
    expect(p4.y).toBeCloseTo(10, 5)
    const p3 = result.document.objects.find((object) => object.id === 'P3')
    if (!p3 || p3.type !== 'point') return
    expect(Math.hypot(p4.x - p3.x, p4.y - p3.y)).toBeCloseTo(100, 5)
  })

  it('keeps equal-length triangle legs rigid while an unrelated square is dragged', () => {
    let document = buildShape(createGeometryDocument(), 'square', 20, 20, 100, 100)
    const squareIds = ['P1', 'P2', 'P3', 'P4']
    document = buildShape(document, 'equilateral', 300, 300, 400, 300)
    const allPointIds = document.objects.filter((object) => object.type === 'point').map((object) => object.id)
    const triangleIds = allPointIds.filter((id) => !squareIds.includes(id))
    const triangleBefore = shapePoints(document, triangleIds)
    const dragged = document.objects.map((object) => object.type === 'point' && object.id === 'P1' ? { ...object, x: 28, y: 32 } : object)
    const result = solveGeometry({ ...document, objects: dragged }, document.constraints, 12, 'P1')
    expect(result.status).not.toBe('diverged')
    expect(shapePoints(result.document, triangleIds)).toEqual(triangleBefore)
  })
})

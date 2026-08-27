import { describe, expect, it } from 'vitest'
import { addArc, addCircle, addPoint, addSegment, createGeometryDocument, hitTest, pickGeometryTarget } from '../index'

describe('geometry hit testing', () => {
  it('detects points, segment edges, and circle edges', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 100, 0); document = addSegment(document, 'P1', 'P2'); document = addCircle(document, 'P1', 50)
    expect(hitTest(document, { x: 0, y: 0 })[0].id).toBe('P1')
    expect(hitTest(document, { x: 50, y: 0 }).map((hit) => hit.id)).toContain('S1')
    expect(hitTest(document, { x: 0, y: 50 }).map((hit) => hit.id)).toContain('C1')
  })

  it('returns semantic endpoint and curve targets', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 100, 0); document = addSegment(document, 'P1', 'P2')
    expect(pickGeometryTarget(document, { x: 0, y: 0 }).type).toBe('endpoint')
    expect(pickGeometryTarget(document, { x: 50, y: 2 }).type).toBe('curve')
  })

  it('returns anchored arc endpoints as semantic endpoint targets', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0)
    document = addPoint(document, 50, 0)
    document = addPoint(document, 0, 50)
    document = addArc(document, 'P1', 50, 0, Math.PI / 2, { startAnchor: 'P2', endAnchor: 'P3' })
    expect(pickGeometryTarget(document, { x: 50, y: 0 }).type).toBe('endpoint')
    expect(pickGeometryTarget(document, { x: 50, y: 0 })).toMatchObject({ pointId: 'P2', curveId: 'A1', endpoint: 'start' })
    expect(pickGeometryTarget(document, { x: 0, y: 50 })).toMatchObject({ pointId: 'P3', curveId: 'A1', endpoint: 'end' })
  })
})

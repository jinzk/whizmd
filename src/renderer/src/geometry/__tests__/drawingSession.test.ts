import { describe, expect, it } from 'vitest'
import { addPoint, createGeometryDocument, createPolygonDrawingSession, appendPolygonVertex, finishPolygonSession } from '../index'

describe('polygon drawing session', () => {
  it('finishes a polygon as one geometry operation', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 5, 10)
    let session = createPolygonDrawingSession()
    session = appendPolygonVertex(session, 'P1'); session = appendPolygonVertex(session, 'P2'); session = appendPolygonVertex(session, 'P3')
    expect(finishPolygonSession(document, session).objects.filter((object) => object.type === 'segment')).toHaveLength(3)
  })
})

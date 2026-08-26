import type { GeometryDocument } from './model'
import { addSegment } from './model'

export type PolygonDrawingSession = { vertexIds: string[] }

export function createPolygonDrawingSession(): PolygonDrawingSession { return { vertexIds: [] } }
export function appendPolygonVertex(session: PolygonDrawingSession, pointId: string): PolygonDrawingSession { return { vertexIds: [...session.vertexIds, pointId] } }
export function canFinishPolygon(session: PolygonDrawingSession): boolean { return session.vertexIds.length >= 3 }
export function finishPolygonSession(document: GeometryDocument, session: PolygonDrawingSession): GeometryDocument {
  if (!canFinishPolygon(session)) return document
  return session.vertexIds.reduce((current, start, index) => addSegment(current, start, session.vertexIds[(index + 1) % session.vertexIds.length]), document)
}
export function closePolygonSession(document: GeometryDocument, session: PolygonDrawingSession): GeometryDocument {
  if (!canFinishPolygon(session)) return document
  return addSegment(document, session.vertexIds.at(-1)!, session.vertexIds[0])
}

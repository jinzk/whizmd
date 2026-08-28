import type { GeometryArc, GeometryDocument, GeometryLineStyle, GeometryTextAnchor } from './model'
import { addConstraint, type GeometryConstraint } from './constraints'
import { getGeometryObject, movePoint, removeObject, resizeCircle } from './model'

export function setPointLabel(document: GeometryDocument, pointId: string, label: string): GeometryDocument {
  const points = document.points.map((object) => object.id === pointId ? { ...object, label: label || undefined } : object)
  return { ...document, points }
}

export function setPointCoordinates(document: GeometryDocument, pointId: string, x: number, y: number): GeometryDocument {
  return Number.isFinite(x) && Number.isFinite(y) ? movePoint(document, pointId, x, y) : document
}

export function setPointStyle(document: GeometryDocument, pointId: string, patch: { color?: string; size?: number }): GeometryDocument {
  const safePatch = { ...patch, size: patch.size === undefined ? undefined : Math.max(1, Number.isFinite(patch.size) ? patch.size : 1) }
  const points = document.points.map((object) => object.id === pointId ? { ...object, ...safePatch } : object)
  return { ...document, points }
}

export function setSegmentStyle(document: GeometryDocument, segmentId: string, patch: { color?: string; lineWidth?: number; lineStyle?: GeometryLineStyle }): GeometryDocument {
  const safePatch = { ...patch, lineWidth: patch.lineWidth === undefined ? undefined : Math.max(0.25, Number.isFinite(patch.lineWidth) ? patch.lineWidth : 0.25) }
  const segments = document.segments.map((object) => object.id === segmentId ? { ...object, ...safePatch } : object)
  return { ...document, segments }
}

export function setTextValue(document: GeometryDocument, textId: string, text: string): GeometryDocument {
  const annotations = document.annotations.map((object) => object.id === textId ? { ...object, text } : object)
  return { ...document, annotations }
}

export function setTextPosition(document: GeometryDocument, textId: string, x: number, y: number): GeometryDocument {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return document
  const annotations = document.annotations.map((object) => object.id === textId ? { ...object, x, y, anchor: undefined } : object)
  return { ...document, annotations }
}

export function setTextStyle(document: GeometryDocument, textId: string, patch: { fontSize?: number; color?: string; rotation?: number }): GeometryDocument {
  const annotations = document.annotations.map((object) => object.id === textId ? { ...object, ...patch } : object)
  return { ...document, annotations }
}

export function setTextAnchor(document: GeometryDocument, textId: string, anchor: GeometryTextAnchor | undefined): GeometryDocument {
  const annotations = document.annotations.map((object) => object.id === textId ? { ...object, anchor } : object)
  return { ...document, annotations }
}

export function setCircleRadius(document: GeometryDocument, circleId: string, radius: number): GeometryDocument {
  return Number.isFinite(radius) && radius > 0 ? resizeCircle(document, circleId, radius) : document
}

export function setArcProperties(document: GeometryDocument, arcId: string, patch: Partial<GeometryArc>): GeometryDocument {
  const curves = document.curves.map((object) => object.type === 'arc' && object.id === arcId ? { ...object, ...patch } : object)
  return { ...document, curves }
}

export function setEllipseSemiMajor(document: GeometryDocument, ellipseId: string, semiMajor: number): GeometryDocument {
  return Number.isFinite(semiMajor) && semiMajor > 0
    ? (() => { const curves = document.curves.map((object) => object.type === 'ellipse' && object.id === ellipseId ? { ...object, semiMajor } : object); return { ...document, curves } })()
    : document
}

export function setSegmentLength(document: GeometryDocument, segmentId: string, length: number): GeometryDocument {
  if (!Number.isFinite(length) || length <= 0) return document
  const segment = getGeometryObject(document, segmentId)
  if (!segment || segment.type !== 'segment') return document
  const index = document.constraints.findIndex((constraint) => constraint.type === 'fixedDistance' && ((constraint.a === segment.start && constraint.b === segment.end) || (constraint.a === segment.end && constraint.b === segment.start)))
  if (index >= 0) {
    return { ...document, constraints: document.constraints.map((constraint, current) => current === index && constraint.type === 'fixedDistance' ? { ...constraint, value: length } : constraint) }
  }
  return addConstraint(document, { type: 'fixedDistance', a: segment.start, b: segment.end, value: length })
}

export function setVertexAngle(document: GeometryDocument, pointId: string, a: string, b: string, sign: 1 | -1, degrees: number): GeometryDocument {
  if (!Number.isFinite(degrees) || degrees <= 0 || degrees >= 180) return document
  const constraints = document.constraints.filter((constraint) => !(constraint.type === 'fixedAngle' && (constraint.vertex === pointId || constraint.a === pointId || constraint.b === pointId)))
  const constraint: GeometryConstraint = { type: 'fixedAngle', a, vertex: pointId, b, value: sign * (degrees * Math.PI) / 180 }
  return addConstraint({ ...document, constraints }, constraint)
}

export function deleteObjects(document: GeometryDocument, objectIds: readonly string[]): GeometryDocument {
  return objectIds.reduce((current, id) => removeObject(current, id), document)
}

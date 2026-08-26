export type GeometryPoint = { type: 'point'; id: string; x: number; y: number; label?: string }
export type GeometrySegment = { type: 'segment'; id: string; start: string; end: string }
export type GeometryCircle = { type: 'circle'; id: string; center: string; radius: number }
export type GeometryEllipse = { type: 'ellipse'; id: string; focusA: string; focusB: string; semiMajor: number }
export type GeometryArc = { type: 'arc'; id: string; center: string; radius: number; startAngle: number; endAngle: number; startAnchor?: string; endAnchor?: string }
export type GeometryText = { type: 'text'; id: string; x: number; y: number; text: string }
export type GeometryMidpoint = { type: 'midpoint'; id: string; a: string; b: string }
export type GeometryIntersection = { type: 'intersection'; id: string; lineA: string; lineB: string }
export type GeometryPerpendicularFoot = { type: 'perpendicularFoot'; id: string; point: string; line: string }
export type GeometryObject = GeometryPoint | GeometrySegment | GeometryCircle | GeometryEllipse | GeometryArc | GeometryText | GeometryMidpoint | GeometryIntersection | GeometryPerpendicularFoot
import type { GeometryConstraint } from './constraints'
import { resolvePoint } from './calculations'

export type GeometryTopology = { nodeIds: string[] }
export type GeometryDocument = { version: 1; width: number; height: number; objects: GeometryObject[]; constraints: GeometryConstraint[]; topology: GeometryTopology }

export function createGeometryDocument(): GeometryDocument {
  return { version: 1, width: 800, height: 500, objects: [], constraints: [], topology: { nodeIds: [] } }
}

export function nextObjectId(document: GeometryDocument, prefix: string): string {
  const base = document.objects.reduce((max, object) => (object.id.startsWith(prefix) ? Math.max(max, Number(object.id.slice(prefix.length)) || 0) : max), 0)
  return `${prefix}${base + 1}`
}

export function addPoint(document: GeometryDocument, x: number, y: number, label?: string): GeometryDocument {
  const id = nextObjectId(document, 'P')
  return { ...document, objects: [...document.objects, { type: 'point', id, x, y, label }], topology: { nodeIds: [...document.topology.nodeIds, id] } }
}

export function addSegment(document: GeometryDocument, start: string, end: string): GeometryDocument {
  const id = nextObjectId(document, 'S')
  return { ...document, objects: [...document.objects, { type: 'segment', id, start, end }] }
}

export function splitSegment(document: GeometryDocument, segmentId: string, pointId: string): GeometryDocument {
  const segment = document.objects.find((object) => object.type === 'segment' && object.id === segmentId)
  if (!segment || segment.type !== 'segment' || segment.start === pointId || segment.end === pointId) return document
  const remaining = document.objects.filter((object) => object.id !== segmentId)
  const base = remaining.reduce((max, object) => object.type === 'segment' ? Math.max(max, Number(object.id.slice(1)) || 0) : max, 0)
  const firstId = `S${base + 1}`
  const secondId = `S${base + 2}`
  return { ...document, objects: [...remaining, { type: 'segment', id: firstId, start: segment.start, end: pointId }, { type: 'segment', id: secondId, start: pointId, end: segment.end }], topology: { nodeIds: document.topology.nodeIds.includes(pointId) ? document.topology.nodeIds : [...document.topology.nodeIds, pointId] } }
}

export function addCircle(document: GeometryDocument, center: string, radius: number): GeometryDocument {
  const id = nextObjectId(document, 'C')
  return { ...document, objects: [...document.objects, { type: 'circle', id, center, radius }] }
}

export function addEllipse(document: GeometryDocument, focusA: string, focusB: string, semiMajor: number): GeometryDocument {
  const id = nextObjectId(document, 'E')
  return { ...document, objects: [...document.objects, { type: 'ellipse', id, focusA, focusB, semiMajor: Math.max(1, semiMajor) }] }
}

export function addArc(document: GeometryDocument, center: string, radius: number, startAngle: number, endAngle: number, anchors?: { startAnchor?: string; endAnchor?: string }): GeometryDocument {
  const id = nextObjectId(document, 'A')
  return { ...document, objects: [...document.objects, { type: 'arc', id, center, radius, startAngle, endAngle, startAnchor: anchors?.startAnchor, endAnchor: anchors?.endAnchor }] }
}

export function addText(document: GeometryDocument, x: number, y: number, text: string): GeometryDocument {
  const id = nextObjectId(document, 'T')
  return { ...document, objects: [...document.objects, { type: 'text', id, x, y, text }] }
}

export function movePoint(document: GeometryDocument, id: string, x: number, y: number): GeometryDocument {
  return { ...document, objects: document.objects.map((object) => object.type === 'point' && object.id === id ? { ...object, x, y } : object) }
}

export type MergePointsRejection = 'sameSegment' | 'digon'

export function checkMergePoints(document: GeometryDocument, keepId: string, removeId: string): MergePointsRejection | null {
  if (keepId === removeId) return null
  if (document.objects.some((object) => object.type === 'segment' && pointsOnSameSegment(document, object, keepId, removeId))) return 'sameSegment'
  if (wouldCreateDigon(document, keepId, removeId)) return 'digon'
  return null
}

export function mergePoints(document: GeometryDocument, keepId: string, removeId: string): GeometryDocument {
  if (checkMergePoints(document, keepId, removeId)) return document
  const objects = document.objects.filter((object) => object.id !== removeId).map((object) => {
    if (object.type === 'segment') return { ...object, start: object.start === removeId ? keepId : object.start, end: object.end === removeId ? keepId : object.end }
    if (object.type === 'circle') return { ...object, center: object.center === removeId ? keepId : object.center }
    if (object.type === 'ellipse') return { ...object, focusA: object.focusA === removeId ? keepId : object.focusA, focusB: object.focusB === removeId ? keepId : object.focusB }
    if (object.type === 'arc') return { ...object, center: object.center === removeId ? keepId : object.center, startAnchor: object.startAnchor === removeId ? keepId : object.startAnchor, endAnchor: object.endAnchor === removeId ? keepId : object.endAnchor }
    if (object.type === 'midpoint') return { ...object, a: object.a === removeId ? keepId : object.a, b: object.b === removeId ? keepId : object.b }
    if (object.type === 'perpendicularFoot') return { ...object, point: object.point === removeId ? keepId : object.point }
    return object
  })
  const constraints = document.constraints.filter((constraint) => !(constraint.type === 'coincident' && (constraint.pointA === removeId || constraint.pointB === removeId))).map((constraint) => {
    if (constraint.type === 'coincident') return { ...constraint, pointA: constraint.pointA === removeId ? keepId : constraint.pointA, pointB: constraint.pointB === removeId ? keepId : constraint.pointB }
    if (constraint.type === 'pointOnLine') return { ...constraint, point: constraint.point === removeId ? keepId : constraint.point }
    if (constraint.type === 'fixedDistance') return { ...constraint, a: constraint.a === removeId ? keepId : constraint.a, b: constraint.b === removeId ? keepId : constraint.b }
    if (constraint.type === 'fixedAngle') return { ...constraint, a: constraint.a === removeId ? keepId : constraint.a, vertex: constraint.vertex === removeId ? keepId : constraint.vertex, b: constraint.b === removeId ? keepId : constraint.b }
    if (constraint.type === 'symmetric') return { ...constraint, a: constraint.a === removeId ? keepId : constraint.a, b: constraint.b === removeId ? keepId : constraint.b }
    return constraint
  })
  return { ...document, objects, constraints, topology: { nodeIds: document.topology.nodeIds.filter((id) => id !== removeId) } }
}

function wouldCreateDigon(document: GeometryDocument, keepId: string, removeId: string): boolean {
  const pairs = new Set<string>()
  for (const object of document.objects) {
    if (object.type !== 'segment') continue
    const start = object.start === removeId ? keepId : object.start
    const end = object.end === removeId ? keepId : object.end
    if (start === end) return true
    const pair = [start, end].sort().join(':')
    if (pairs.has(pair)) return true
    pairs.add(pair)
  }
  return false
}

function pointsOnSameSegment(document: GeometryDocument, segment: GeometrySegment, firstId: string, secondId: string): boolean {
  const first = resolvePoint(document, firstId); const second = resolvePoint(document, secondId)
  const start = resolvePoint(document, segment.start); const end = resolvePoint(document, segment.end)
  if (!first || !second || !start || !end) return false
  const dx = end.x - start.x; const dy = end.y - start.y; const lengthSquared = dx * dx + dy * dy
  if (!lengthSquared) return false
  const crossFirst = (first.x - start.x) * dy - (first.y - start.y) * dx
  const crossSecond = (second.x - start.x) * dy - (second.y - start.y) * dx
  const parameterFirst = ((first.x - start.x) * dx + (first.y - start.y) * dy) / lengthSquared
  const parameterSecond = ((second.x - start.x) * dx + (second.y - start.y) * dy) / lengthSquared
  return Math.abs(crossFirst) <= 1e-6 && Math.abs(crossSecond) <= 1e-6 && parameterFirst >= -1e-6 && parameterFirst <= 1 + 1e-6 && parameterSecond >= -1e-6 && parameterSecond <= 1 + 1e-6
}

export function resizeCircle(document: GeometryDocument, id: string, radius: number): GeometryDocument {
  return { ...document, objects: document.objects.map((object) => object.type === 'circle' && object.id === id ? { ...object, radius: Math.max(1, radius) } : object) }
}

export function removeObject(document: GeometryDocument, id: string): GeometryDocument {
  return { ...document, objects: document.objects.filter((object) => object.id !== id && !objectReferences(object, id)) }
}

function objectReferences(object: GeometryObject, id: string): boolean {
  return     (object.type === 'segment' && (object.start === id || object.end === id)) ||
    (object.type === 'circle' && object.center === id) ||
    (object.type === 'ellipse' && (object.focusA === id || object.focusB === id)) ||
    (object.type === 'arc' && (object.center === id || object.startAnchor === id || object.endAnchor === id)) ||
    (object.type === 'arc' && object.center === id) ||
    (object.type === 'midpoint' && (object.a === id || object.b === id)) ||
    (object.type === 'intersection' && (object.lineA === id || object.lineB === id)) ||
    (object.type === 'perpendicularFoot' && (object.point === id || object.line === id))
}

export function addMidpoint(document: GeometryDocument, a: string, b: string): GeometryDocument {
  const id = `M${document.objects.filter((object) => object.type === 'midpoint').length + 1}`
  return { ...document, objects: [...document.objects, { type: 'midpoint', id, a, b }] }
}

export function addIntersection(document: GeometryDocument, lineA: string, lineB: string): GeometryDocument {
  const id = `I${document.objects.filter((object) => object.type === 'intersection').length + 1}`
  return { ...document, objects: [...document.objects, { type: 'intersection', id, lineA, lineB }] }
}

export function materializeIntersection(document: GeometryDocument, intersectionId: string): GeometryDocument {
  const derived = document.objects.find((object) => object.type === 'intersection' && object.id === intersectionId)
  if (!derived || derived.type !== 'intersection') return document
  const first = document.objects.find((object) => object.type === 'segment' && object.id === derived.lineA)
  const second = document.objects.find((object) => object.type === 'segment' && object.id === derived.lineB)
  if (!first || !second) return document
  const at = resolvePoint(document, intersectionId)
  if (!at) return document
  let next = addPoint(document, at.x, at.y)
  const pointId = next.objects.at(-1)!.id
  next = splitSegment(next, derived.lineA, pointId)
  next = splitSegment(next, derived.lineB, pointId)
  return { ...next, objects: next.objects.filter((object) => object.id !== intersectionId) }
}

export function addPerpendicularFoot(document: GeometryDocument, point: string, line: string): GeometryDocument {
  const id = `H${document.objects.filter((object) => object.type === 'perpendicularFoot').length + 1}`
  return { ...document, objects: [...document.objects, { type: 'perpendicularFoot', id, point, line }] }
}

export type GeometryRole = 'boundary' | 'construction' | 'attachment'
export type GeometryShapeKind = 'circle' | 'ellipse' | 'square' | 'rectangle' | 'parallelogram' | 'rhombus' | 'equilateral' | 'isosceles' | 'rightTriangle'
export type GeometryShape = { id: string; kind: GeometryShapeKind; boundaryPointIds: string[]; boundarySegmentIds: string[] }
export type GeometrySharedNode = { id: string; memberIds: string[] }
export type GeometryDependency = { id: string; sourceId: string; dependencyIds: string[]; kind: 'midpoint' | 'intersection' | 'pointOnLine' | 'textAnchor' }
export type GeometryPointAttachment = { objectId: string; kind: 'segment' | 'circle' | 'arc' | 'ellipse'; parameter: number }
export type GeometryPoint = { type: 'point'; id: string; x: number; y: number; label?: string; ownerId?: string; role?: GeometryRole; attachment?: GeometryPointAttachment }
export type GeometrySegment = { type: 'segment'; id: string; start: string; end: string; ownerId?: string; role?: GeometryRole }
export type GeometryCircle = { type: 'circle'; id: string; center: string; radius: number }
export type GeometryEllipse = { type: 'ellipse'; id: string; focusA: string; focusB: string; semiMajor: number }
export type GeometryArc = { type: 'arc'; id: string; center: string; radius: number; startAngle: number; endAngle: number; startAnchor?: string; endAnchor?: string }
export type GeometryTextAnchor = { objectId: string; t: number; offsetX: number; offsetY: number }
export type GeometryText = { type: 'text'; id: string; x: number; y: number; text: string; fontSize?: number; color?: string; rotation?: number; anchor?: GeometryTextAnchor }
export type GeometryObject = GeometryPoint | GeometrySegment | GeometryCircle | GeometryEllipse | GeometryArc | GeometryText
export type GeometryCurveObject = GeometryCircle | GeometryEllipse | GeometryArc
export type GeometryCollections = {
  points: GeometryPoint[]
  segments: GeometrySegment[]
  curves: GeometryCurveObject[]
  annotations: GeometryText[]
}
import type { GeometryConstraint } from './constraints'
import { resolvePoint } from './calculations'

export type GeometryTopology = { nodeIds: string[] }
export type GeometryDocument = { version: 1; width: number; height: number; points: GeometryPoint[]; segments: GeometrySegment[]; curves: GeometryCurveObject[]; annotations: GeometryText[]; constraints: GeometryConstraint[]; topology: GeometryTopology; shapes: GeometryShape[]; sharedNodes: GeometrySharedNode[]; dependencies: GeometryDependency[] }

// Geometry uses a 40-unit/cm working grid; the document dimensions retain a useful canvas range.
export const GEOMETRY_UNITS_PER_CM = 40
export const A4_WIDTH_CM = 21
export const A4_HEIGHT_CM = 29.7
export const A4_WIDTH_UNITS = A4_WIDTH_CM * GEOMETRY_UNITS_PER_CM
export const A4_HEIGHT_UNITS = A4_HEIGHT_CM * GEOMETRY_UNITS_PER_CM

export function createGeometryDocument(): GeometryDocument {
  return { version: 1, width: A4_WIDTH_UNITS, height: A4_HEIGHT_UNITS, points: [], segments: [], curves: [], annotations: [], constraints: [], topology: { nodeIds: [] }, shapes: [], sharedNodes: [], dependencies: [] }
}

export function splitGeometryObjects(objects: readonly GeometryObject[]): GeometryCollections {
  return {
    points: objects.filter((object): object is GeometryPoint => object.type === 'point'),
    segments: objects.filter((object): object is GeometrySegment => object.type === 'segment'),
    curves: objects.filter((object): object is GeometryCurveObject => object.type === 'circle' || object.type === 'ellipse' || object.type === 'arc'),
    annotations: objects.filter((object): object is GeometryText => object.type === 'text')
  }
}

export function buildGeometryObjects(document: Pick<GeometryDocument, 'points' | 'segments' | 'curves' | 'annotations'>): GeometryObject[] { return [...document.points, ...document.segments, ...document.curves, ...document.annotations] }

export function nextObjectId(document: GeometryDocument, prefix: string): string {
  const base = buildGeometryObjects(document).reduce((max, object) => (object.id.startsWith(prefix) ? Math.max(max, Number(object.id.slice(prefix.length)) || 0) : max), 0)
  return `${prefix}${base + 1}`
}

export function getGeometryObject(document: GeometryDocument, id: string): GeometryObject | undefined {
  return buildGeometryObjects(document).find((object) => object.id === id)
}

export function getGeometryObjects<T extends GeometryObject['type']>(document: GeometryDocument, type: T): Extract<GeometryObject, { type: T }>[] {
  return buildGeometryObjects(document).filter((object) => object.type === type) as Extract<GeometryObject, { type: T }>[]
}

export function addPoint(document: GeometryDocument, x: number, y: number, label?: string, metadata?: Pick<GeometryPoint, 'ownerId' | 'role'>): GeometryDocument {
  const id = nextObjectId(document, 'P')
  const point = { type: 'point' as const, id, x, y, label, ...metadata }
  const points = [...document.points, point]
  return { ...document, points, topology: { nodeIds: [...document.topology.nodeIds, id] } }
}

export function addSegment(document: GeometryDocument, start: string, end: string, metadata?: Pick<GeometrySegment, 'ownerId' | 'role'>): GeometryDocument {
  const id = nextObjectId(document, 'S')
  const segment = { type: 'segment' as const, id, start, end, ...metadata }
  const segments = [...document.segments, segment]
  return { ...document, segments }
}

export function addShape(document: GeometryDocument, shape: GeometryShape): GeometryDocument {
  return { ...document, shapes: [...document.shapes, { ...shape, boundaryPointIds: [...shape.boundaryPointIds], boundarySegmentIds: [...shape.boundarySegmentIds] }] }
}

export function rebuildGeometryGraphs(document: GeometryDocument): GeometryDocument {
  const allObjects = buildGeometryObjects(document)
  const sharedNodes = document.topology.nodeIds.map((id) => ({
    id,
    memberIds: allObjects.flatMap((object) => {
      if (object.type === 'segment' && (object.start === id || object.end === id)) return [object.id]
       if ((object.type === 'circle' && object.center === id) || (object.type === 'ellipse' && (object.focusA === id || object.focusB === id)) || (object.type === 'arc' && [object.center, object.startAnchor, object.endAnchor].includes(id))) return [object.id]
      return []
    })
  }))
  const dependencies = document.constraints.flatMap((constraint, index): GeometryDependency[] => {
    if (constraint.type === 'midpoint') return [{ id: `D${index + 1}`, sourceId: constraint.point, dependencyIds: [constraint.line], kind: 'midpoint' as const }]
    if (constraint.type === 'intersection') return [{ id: `D${index + 1}`, sourceId: constraint.point, dependencyIds: [constraint.lineA, constraint.lineB], kind: 'intersection' as const }]
    if (constraint.type === 'pointOnLine') return [{ id: `D${index + 1}`, sourceId: constraint.point, dependencyIds: [constraint.line], kind: 'pointOnLine' as const }]
    return []
  })
  for (const object of allObjects) {
    if (object.type === 'text' && object.anchor) dependencies.push({ id: `DT-${object.id}`, sourceId: object.id, dependencyIds: [object.anchor.objectId], kind: 'textAnchor' })
  }
  return { ...document, sharedNodes, dependencies }
}

export function addCircle(document: GeometryDocument, center: string, radius: number): GeometryDocument {
  const id = nextObjectId(document, 'C')
  const circle = { type: 'circle' as const, id, center, radius }
  const curves = [...document.curves, circle]
  return { ...document, curves }
}

export function addEllipse(document: GeometryDocument, focusA: string, focusB: string, semiMajor: number): GeometryDocument {
  const id = nextObjectId(document, 'E')
  const ellipse = { type: 'ellipse' as const, id, focusA, focusB, semiMajor: Math.max(1, semiMajor) }
  const curves = [...document.curves, ellipse]
  return { ...document, curves }
}

export function addArc(document: GeometryDocument, center: string, radius: number, startAngle: number, endAngle: number, anchors?: { startAnchor?: string; endAnchor?: string }): GeometryDocument {
  const id = nextObjectId(document, 'A')
  const arc = { type: 'arc' as const, id, center, radius, startAngle, endAngle, startAnchor: anchors?.startAnchor, endAnchor: anchors?.endAnchor }
  const curves = [...document.curves, arc]
  return { ...document, curves }
}

export function addText(document: GeometryDocument, x: number, y: number, text: string): GeometryDocument {
  const id = nextObjectId(document, 'T')
  const annotation = { type: 'text' as const, id, x, y, text }
  const annotations = [...document.annotations, annotation]
  return { ...document, annotations }
}

export function movePoint(document: GeometryDocument, id: string, x: number, y: number): GeometryDocument {
  const points = document.points.map((object) => object.id === id ? { ...object, x, y } : object)
  return { ...document, points }
}

export type MergePointsRejection = 'sameSegment' | 'digon'

export function checkMergePoints(document: GeometryDocument, keepId: string, removeId: string): MergePointsRejection | null {
  if (keepId === removeId) return null
  const coincidentIntersectionEndpoint = isCoincidentIntersectionEndpoint(document, keepId, removeId)
  const coincidentEndpoints = isCoincidentEndpoints(document, keepId, removeId)
  if (!coincidentIntersectionEndpoint && !coincidentEndpoints && document.segments.some((object) => pointsOnSameSegment(document, object, keepId, removeId))) return 'sameSegment'
  if (wouldCreateDigon(document, keepId, removeId)) return 'digon'
  return null
}

function isCoincidentEndpoints(document: GeometryDocument, firstId: string, secondId: string): boolean {
  const first = resolvePoint(document, firstId); const second = resolvePoint(document, secondId)
  if (!first || !second || Math.hypot(first.x - second.x, first.y - second.y) > 1e-6) return false
  const endpointObjects = (id: string): string[] => [
    ...document.segments.filter((object) => object.start === id || object.end === id).map((object) => object.id),
    ...document.curves.filter((object) => object.type === 'arc' && (object.startAnchor === id || object.endAnchor === id)).map((object) => object.id)
  ]
  const firstObjects = endpointObjects(firstId); const secondObjects = endpointObjects(secondId)
  return firstObjects.length > 0 && secondObjects.length > 0 && !firstObjects.some((id) => secondObjects.includes(id))
}

function isCoincidentIntersectionEndpoint(document: GeometryDocument, firstId: string, secondId: string): boolean {
  const first = resolvePoint(document, firstId); const second = resolvePoint(document, secondId)
  if (!first || !second || Math.hypot(first.x - second.x, first.y - second.y) > 1e-6) return false
  const isEndpoint = (id: string): boolean => document.segments.some((object) => object.start === id || object.end === id) || document.curves.some((object) => object.type === 'arc' && (object.startAnchor === id || object.endAnchor === id))
  const isIntersection = (id: string): boolean => document.constraints.some((constraint) => constraint.type === 'intersection' && constraint.point === id)
  return (isEndpoint(firstId) && isIntersection(secondId)) || (isEndpoint(secondId) && isIntersection(firstId))
}

export function mergePoints(document: GeometryDocument, keepId: string, removeId: string): GeometryDocument {
  if (checkMergePoints(document, keepId, removeId)) return document
  const objects = buildGeometryObjects(document).filter((object) => object.id !== removeId).map((object) => {
    if (object.type === 'segment') return { ...object, start: object.start === removeId ? keepId : object.start, end: object.end === removeId ? keepId : object.end }
    if (object.type === 'circle') return { ...object, center: object.center === removeId ? keepId : object.center }
    if (object.type === 'ellipse') return { ...object, focusA: object.focusA === removeId ? keepId : object.focusA, focusB: object.focusB === removeId ? keepId : object.focusB }
    if (object.type === 'arc') return { ...object, center: object.center === removeId ? keepId : object.center, startAnchor: object.startAnchor === removeId ? keepId : object.startAnchor, endAnchor: object.endAnchor === removeId ? keepId : object.endAnchor }
    return object
  })
  const constraints = document.constraints.filter((constraint) => !(constraint.type === 'coincident' && (constraint.pointA === removeId || constraint.pointB === removeId))).map((constraint) => {
    if (constraint.type === 'coincident') return { ...constraint, pointA: constraint.pointA === removeId ? keepId : constraint.pointA, pointB: constraint.pointB === removeId ? keepId : constraint.pointB }
    if (constraint.type === 'pointOnLine') return { ...constraint, point: constraint.point === removeId ? keepId : constraint.point }
    if (constraint.type === 'midpoint') return { ...constraint, point: constraint.point === removeId ? keepId : constraint.point }
    if (constraint.type === 'intersection') return { ...constraint, point: constraint.point === removeId ? keepId : constraint.point }
    if (constraint.type === 'fixedDistance') return { ...constraint, a: constraint.a === removeId ? keepId : constraint.a, b: constraint.b === removeId ? keepId : constraint.b }
    if (constraint.type === 'fixedAngle') return { ...constraint, a: constraint.a === removeId ? keepId : constraint.a, vertex: constraint.vertex === removeId ? keepId : constraint.vertex, b: constraint.b === removeId ? keepId : constraint.b }
    if (constraint.type === 'symmetric') return { ...constraint, a: constraint.a === removeId ? keepId : constraint.a, b: constraint.b === removeId ? keepId : constraint.b }
    return constraint
  })
  const collections = splitGeometryObjects(objects)
  const merged = { ...document, ...collections, constraints, topology: { nodeIds: document.topology.nodeIds.filter((id) => id !== removeId) } }
  const keep = resolvePoint(merged, keepId)
  if (!keep) return merged
  const duplicateIntersection = merged.constraints
    .filter((constraint): constraint is Extract<GeometryConstraint, { type: 'intersection' }> => constraint.type === 'intersection' && constraint.point !== keepId)
    .map((constraint) => constraint.point)
    .find((id) => {
      const point = resolvePoint(merged, id)
      return point && Math.hypot(point.x - keep.x, point.y - keep.y) <= 1e-6 &&
        merged.segments.some((object) => object.start === keepId || object.end === keepId)
    })
  return rebuildGeometryGraphs(duplicateIntersection ? mergePoints(merged, keepId, duplicateIntersection) : merged)
}

export function mergePointsTopology(document: GeometryDocument, keepId: string, removeId: string): GeometryDocument {
  const point = document.points.find((object) => object.id === keepId)
  const removed = document.points.find((object) => object.id === removeId)
  if (!point || point.type !== 'point' || !removed || removed.type !== 'point') return document
  const objects = buildGeometryObjects(document).filter((object) => object.id !== removeId).map((object) => {
    if (object.type === 'segment') return { ...object, start: object.start === removeId ? keepId : object.start, end: object.end === removeId ? keepId : object.end }
    if (object.type === 'circle') return { ...object, center: object.center === removeId ? keepId : object.center }
    if (object.type === 'ellipse') return { ...object, focusA: object.focusA === removeId ? keepId : object.focusA, focusB: object.focusB === removeId ? keepId : object.focusB }
    if (object.type === 'arc') return { ...object, center: object.center === removeId ? keepId : object.center, startAnchor: object.startAnchor === removeId ? keepId : object.startAnchor, endAnchor: object.endAnchor === removeId ? keepId : object.endAnchor }
    return object
  })
  const constraints = document.constraints.map((constraint) => {
    const replace = (id: string): string => id === removeId ? keepId : id
    if (constraint.type === 'coincident') return { ...constraint, pointA: replace(constraint.pointA), pointB: replace(constraint.pointB) }
    if (constraint.type === 'pointOnLine' || constraint.type === 'midpoint' || constraint.type === 'intersection') return { ...constraint, point: replace(constraint.point) }
    if (constraint.type === 'fixedDistance') return { ...constraint, a: replace(constraint.a), b: replace(constraint.b) }
    if (constraint.type === 'fixedAngle') return { ...constraint, a: replace(constraint.a), vertex: replace(constraint.vertex), b: replace(constraint.b) }
    if (constraint.type === 'symmetric') return { ...constraint, a: replace(constraint.a), b: replace(constraint.b) }
    return constraint
  })
  const shapes = document.shapes.map((shape) => ({ ...shape, boundaryPointIds: shape.boundaryPointIds.map((id) => id === removeId ? keepId : id) }))
  const collections = splitGeometryObjects(objects)
  return { ...document, ...collections, constraints, shapes, topology: { nodeIds: document.topology.nodeIds.filter((id) => id !== removeId) } }
}

export function mergePointsWithConstraints(document: GeometryDocument, keepId: string, removeId: string): GeometryDocument {
  const topology = mergePointsTopology(document, keepId, removeId)
  const constraints = topology.constraints.filter((constraint) => !(constraint.type === 'coincident' && constraint.pointA === constraint.pointB))
  return rebuildGeometryGraphs({ ...topology, constraints })
}

export function splitNode(document: GeometryDocument, nodeId: string, objectId: string): GeometryDocument {
  const node = document.points.find((point) => point.id === nodeId)
  const object = getGeometryObject(document, objectId)
  if (!node || !object || object.id === nodeId) return document
  const connectedObjectCount = buildGeometryObjects(document).filter((item) => item.id !== nodeId && objectReferences(item, nodeId)).length
  if (connectedObjectCount < 2) return document
  const references = object.type === 'segment'
    ? [object.start === nodeId, object.end === nodeId].filter(Boolean).length
    : object.type === 'circle'
      ? Number(object.center === nodeId)
      : object.type === 'ellipse'
        ? Number(object.focusA === nodeId) + Number(object.focusB === nodeId)
        : object.type === 'arc'
          ? Number(object.center === nodeId) + Number(object.startAnchor === nodeId) + Number(object.endAnchor === nodeId)
          : 0
  if (references !== 1) return document
  const newPointId = nextObjectId(document, 'P')
  const newPoint: GeometryPoint = { ...node, id: newPointId }
  const remapped = buildGeometryObjects(document).map((item) => {
    if (item.id !== objectId) return item
    if (item.type === 'segment') return { ...item, start: item.start === nodeId ? newPointId : item.start, end: item.end === nodeId ? newPointId : item.end }
    if (item.type === 'circle') return { ...item, center: item.center === nodeId ? newPointId : item.center }
    if (item.type === 'ellipse') return { ...item, focusA: item.focusA === nodeId ? newPointId : item.focusA, focusB: item.focusB === nodeId ? newPointId : item.focusB }
    if (item.type === 'arc') return { ...item, center: item.center === nodeId ? newPointId : item.center, startAnchor: item.startAnchor === nodeId ? newPointId : item.startAnchor, endAnchor: item.endAnchor === nodeId ? newPointId : item.endAnchor }
    return item
  })
  const collections = splitGeometryObjects([...remapped, newPoint])
  return rebuildGeometryGraphs({ ...document, ...collections, topology: { nodeIds: [...document.topology.nodeIds, newPointId] } })
}


function wouldCreateDigon(document: GeometryDocument, keepId: string, removeId: string): boolean {
  const pairs = new Set<string>()
  for (const object of document.segments) {
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
  const curves = document.curves.map((object) => object.type === 'circle' && object.id === id ? { ...object, radius: Math.max(1, radius) } : object)
  return { ...document, curves }
}

export function removeObject(document: GeometryDocument, id: string): GeometryDocument {
  const removedIds = new Set([id])
  let changed = true
  while (changed) {
    changed = false
    for (const object of buildGeometryObjects(document)) {
      if (!removedIds.has(object.id) && [...removedIds].some((removedId) => objectReferences(object, removedId))) {
        removedIds.add(object.id)
        changed = true
      }
    }
  }
  const removedSegment = document.segments.find((segment) => removedIds.has(segment.id))?.id ?? null
  const objects = buildGeometryObjects(document).filter((object) => !removedIds.has(object.id)).map((object) => object.type === 'text' && object.anchor && removedIds.has(object.anchor.objectId) ? { ...object, anchor: undefined } : object).map((object) => object.type === 'arc' ? { ...object, startAnchor: object.startAnchor && removedIds.has(object.startAnchor) ? undefined : object.startAnchor, endAnchor: object.endAnchor && removedIds.has(object.endAnchor) ? undefined : object.endAnchor } : object)
  const constraints = document.constraints.filter((constraint) => !Object.values(constraint).some((value) => typeof value === 'string' && removedIds.has(value)))
  return rebuildGeometryGraphs({ ...document, ...splitGeometryObjects(objects), constraints, shapes: document.shapes.filter((shape) => !removedIds.has(shape.id)).map((shape) => ({ ...shape, boundaryPointIds: shape.boundaryPointIds.filter((pointId) => !removedIds.has(pointId)), boundarySegmentIds: shape.boundarySegmentIds.filter((segmentId) => segmentId !== (removedSegment ?? id) && !removedIds.has(segmentId)) })) })
}

function objectReferences(object: GeometryObject, id: string): boolean {
   return     (object.type === 'segment' && (object.start === id || object.end === id)) ||
    (object.type === 'circle' && object.center === id) ||
    (object.type === 'ellipse' && (object.focusA === id || object.focusB === id)) ||
     (object.type === 'arc' && (object.center === id || object.startAnchor === id || object.endAnchor === id)) ||
    false
}

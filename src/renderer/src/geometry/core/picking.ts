import type { GeometryDocument } from './model'
import { resolvePoint } from './calculations'
import { getGeometryCurves, type GeometryCoordinate } from './curves'

export type GeometryPickTarget =
  | { type: 'empty'; point: GeometryCoordinate }
  | { type: 'point'; pointId: string; point: GeometryCoordinate; distance: number }
  | { type: 'endpoint'; pointId: string; curveId: string; endpoint: 'start' | 'end'; point: GeometryCoordinate; distance: number }
  | { type: 'curve'; curveId: string; parameter: number; point: GeometryCoordinate; distance: number }

export type PickOptions = { tolerance?: number; endpointTolerance?: number }

export function pickGeometryTarget(document: GeometryDocument, point: GeometryCoordinate, options: PickOptions = {}): GeometryPickTarget {
  const tolerance = options.tolerance ?? 8; const endpointTolerance = options.endpointTolerance ?? 12
  const endpoints = document.objects.flatMap((object) => object.type === 'segment' ? [
    { pointId: object.start, curveId: object.id, endpoint: 'start' as const },
    { pointId: object.end, curveId: object.id, endpoint: 'end' as const },
  ] : [])
  const endpointHit = endpoints.map((item) => ({ ...item, point: resolvePoint(document, item.pointId) })).filter((item): item is typeof item & { point: GeometryCoordinate } => Boolean(item.point)).map((item) => ({ ...item, distance: Math.hypot(point.x - item.point.x, point.y - item.point.y) })).filter((item) => item.distance <= endpointTolerance).sort((a, b) => a.distance - b.distance)[0]
  if (endpointHit) return { type: 'endpoint', ...endpointHit }
  const pointHit = document.objects.filter((object) => object.type === 'point').map((object) => ({ pointId: object.id, point: { x: object.x, y: object.y }, distance: Math.hypot(point.x - object.x, point.y - object.y) })).filter((item) => item.distance <= tolerance).sort((a, b) => a.distance - b.distance)[0]
  if (pointHit) return { type: 'point', ...pointHit }
  const curveHit = getGeometryCurves(document).map((curve) => ({ curve, projection: curve.project(point) })).filter((item): item is typeof item & { projection: NonNullable<typeof item.projection> } => Boolean(item.projection)).filter((item) => item.projection.distance <= tolerance).sort((a, b) => a.projection.distance - b.projection.distance)[0]
  if (curveHit) return { type: 'curve', curveId: curveHit.curve.id, parameter: curveHit.projection.parameter, point: curveHit.projection.point, distance: curveHit.projection.distance }
  return { type: 'empty', point }
}

import type { GeometryDocument } from './model'

export type TopologyIncident = { curveId: string; endpoint: 'start' | 'end' }

export function getNodeIncidents(document: GeometryDocument, nodeId: string): TopologyIncident[] {
  return document.objects.flatMap((object): TopologyIncident[] => object.type === 'segment'
    ? [object.start === nodeId ? { curveId: object.id, endpoint: 'start' } : null, object.end === nodeId ? { curveId: object.id, endpoint: 'end' } : null].filter((item): item is TopologyIncident => Boolean(item))
    : [])
}

export function isTopologyNode(document: GeometryDocument, id: string): boolean { return document.topology.nodeIds.includes(id) }

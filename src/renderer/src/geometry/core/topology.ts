import type { GeometryDocument } from './model'

export type TopologyIncident = { curveId: string; endpoint: 'start' | 'end' }

export function getNodeIncidents(document: GeometryDocument, nodeId: string): TopologyIncident[] {
  const segmentIncidents = document.segments.flatMap((object): TopologyIncident[] => [object.start === nodeId ? { curveId: object.id, endpoint: 'start' } : null, object.end === nodeId ? { curveId: object.id, endpoint: 'end' } : null].filter((item): item is TopologyIncident => Boolean(item)))
  const arcIncidents = document.curves.flatMap((object): TopologyIncident[] => object.type !== 'arc' ? [] : [object.startAnchor === nodeId ? { curveId: object.id, endpoint: 'start' } : null, object.endAnchor === nodeId ? { curveId: object.id, endpoint: 'end' } : null].filter((item): item is TopologyIncident => Boolean(item)))
  return [...segmentIncidents, ...arcIncidents]
}

export function isTopologyNode(document: GeometryDocument, id: string): boolean { return document.topology.nodeIds.includes(id) }

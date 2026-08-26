export type GeometryToolId =
  | 'point' | 'segment' | 'polygon' | 'arc' | 'text'
  | 'midpoint' | 'intersection' | 'perpendicularFoot'
  | 'coincident' | 'parallel' | 'perpendicular' | 'equalLength'
  | 'horizontal' | 'vertical'
  | 'tangent' | 'symmetric' | 'angle'
  | 'splitSegment' | 'splitAtIntersection'
  | 'move' | 'rotate'
  | 'shape'

export type CanvasClickMode = 'draw' | 'selectSequence' | 'singleCurveConstruct' | 'splitIntersection' | 'arcDraft' | 'passive'

export type TargetKind = 'point' | 'segment' | 'circle' | 'arc'

export type GeometryToolProfile = {
  id: GeometryToolId
  canvasClick: CanvasClickMode
  /** Ordered selection slots; each slot lists acceptable target kinds. */
  selects: TargetKind[][]
  /** Run solveGeometry after the selection completes. */
  solveOnCreate: boolean
}

const TWO_POINTS: TargetKind[][] = [['point'], ['point']]
const TWO_SEGMENTS: TargetKind[][] = [['segment'], ['segment']]

export const GEOMETRY_TOOLS: Record<GeometryToolId, GeometryToolProfile> = {
  point: { id: 'point', canvasClick: 'draw', selects: [['point']], solveOnCreate: false },
  segment: { id: 'segment', canvasClick: 'draw', selects: [['point']], solveOnCreate: false },
  polygon: { id: 'polygon', canvasClick: 'draw', selects: [['point']], solveOnCreate: false },
  arc: { id: 'arc', canvasClick: 'arcDraft', selects: [['point']], solveOnCreate: false },
  text: { id: 'text', canvasClick: 'draw', selects: [['point']], solveOnCreate: false },
  midpoint: { id: 'midpoint', canvasClick: 'selectSequence', selects: TWO_POINTS, solveOnCreate: false },
  intersection: { id: 'intersection', canvasClick: 'selectSequence', selects: TWO_SEGMENTS, solveOnCreate: false },
  perpendicularFoot: { id: 'perpendicularFoot', canvasClick: 'selectSequence', selects: [['point'], ['segment']], solveOnCreate: false },
  coincident: { id: 'coincident', canvasClick: 'selectSequence', selects: TWO_POINTS, solveOnCreate: false },
  parallel: { id: 'parallel', canvasClick: 'selectSequence', selects: TWO_SEGMENTS, solveOnCreate: true },
  perpendicular: { id: 'perpendicular', canvasClick: 'selectSequence', selects: TWO_SEGMENTS, solveOnCreate: true },
  equalLength: { id: 'equalLength', canvasClick: 'selectSequence', selects: TWO_SEGMENTS, solveOnCreate: true },
  horizontal: { id: 'horizontal', canvasClick: 'singleCurveConstruct', selects: [['segment']], solveOnCreate: true },
  vertical: { id: 'vertical', canvasClick: 'singleCurveConstruct', selects: [['segment']], solveOnCreate: true },
  tangent: { id: 'tangent', canvasClick: 'selectSequence', selects: [['circle', 'arc', 'segment'], ['circle', 'arc', 'segment']], solveOnCreate: true },
  symmetric: { id: 'symmetric', canvasClick: 'selectSequence', selects: [['point'], ['point'], ['segment']], solveOnCreate: true },
  angle: { id: 'angle', canvasClick: 'selectSequence', selects: [['point'], ['point'], ['point']], solveOnCreate: false },
  splitSegment: { id: 'splitSegment', canvasClick: 'singleCurveConstruct', selects: [['segment']], solveOnCreate: false },
  splitAtIntersection: { id: 'splitAtIntersection', canvasClick: 'splitIntersection', selects: [['point']], solveOnCreate: false },
  move: { id: 'move', canvasClick: 'passive', selects: [['point', 'segment', 'circle', 'arc']], solveOnCreate: false },
  rotate: { id: 'rotate', canvasClick: 'passive', selects: [['point', 'segment']], solveOnCreate: false },
  shape: { id: 'shape', canvasClick: 'passive', selects: [['point', 'segment']], solveOnCreate: true },
}

export function isInteractiveCanvasTool(id: GeometryToolId): boolean {
  return GEOMETRY_TOOLS[id].canvasClick !== 'draw' && GEOMETRY_TOOLS[id].canvasClick !== 'arcDraft'
}

export function acceptsTarget(profile: GeometryToolProfile, slotIndex: number, kind: TargetKind): boolean {
  const slot = profile.selects[slotIndex]
  return Array.isArray(slot) ? slot.includes(kind) : false
}

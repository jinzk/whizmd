import { buildShape, type ShapeKind } from '../../geometry/core/shapeFactory'
import { addEllipse, addPoint, createGeometryDocument, getGeometryObject, getGeometryObjects, resolveEllipseGeometry, type GeometryDocument } from '../../geometry'

type Point = { x: number; y: number }
type Box = { x: number; y: number; width: number; height: number }

type Props = {
  selectionBox: Box | null
  polygonRubberFrom: Point | null
  polygonCursor: Point | null
  polygonFirstVertex: Point | null
  snapHint: Point | null
  arcDraftView: { cx: number; cy: number; radius: number; startAngle: number } | null
  arcCursor: Point | null
  shapeKind: ShapeKind
  shapeAnchor: Point | null
  shapeCursor: Point | null
  ellipsePreview: { focusA: Point; focusB: Point; semiMajor: number } | null
  segmentDraft: { start: Point; cursor: Point } | null
}

function ArcDraftPreview({ view, cursor }: { view: NonNullable<Props['arcDraftView']>; cursor: Point }): React.JSX.Element {
  const cx = view.cx
  const cy = view.cy
  if (view.radius === 0) {
    const r = Math.max(1, Math.hypot(cursor.x - cx, cursor.y - cy))
    return (
      <g className="geometry-preview-line">
        <circle cx={cx} cy={cy} r={r} fill="none" />
        <line x1={cx} y1={cy} x2={cursor.x} y2={cursor.y} />
        <circle cx={cursor.x} cy={cursor.y} r="4" fill="var(--md-accent)" />
      </g>
    )
  }
  const startAngle = view.startAngle
  const endAngle = Math.atan2(cursor.y - cy, cursor.x - cx)
  const sx = cx + view.radius * Math.cos(startAngle)
  const sy = cy + view.radius * Math.sin(startAngle)
  const ex = cx + view.radius * Math.cos(endAngle)
  const ey = cy + view.radius * Math.sin(endAngle)
  const twoPi = Math.PI * 2
  const span = ((endAngle - startAngle) % twoPi + twoPi) % twoPi
  return <path className="geometry-preview-line" d={`M ${sx} ${sy} A ${view.radius} ${view.radius} 0 ${span > Math.PI ? 1 : 0} 1 ${ex} ${ey}`} fill="none" />
}

function ShapeDraftPreview({ kind, anchor, cursor }: { kind: ShapeKind; anchor: Point; cursor: Point }): React.JSX.Element | null {
  const preview = buildShape(createGeometryDocument(), kind, anchor.x, anchor.y, cursor.x, cursor.y)
  if (kind === 'circle') {
    const circle = getGeometryObjects(preview, 'circle')[0]
    const center = circle ? getGeometryObject(preview, circle.center) : undefined
    if (circle && circle.type === 'circle' && center && center.type === 'point') {
      return <circle className="geometry-preview-line" cx={center.x} cy={center.y} r={circle.radius} fill="none" />
    }
    return null
  }
  const byId = new Map([...preview.points, ...preview.segments].map((object) => [object.id, object]))
  const segments = preview.segments
  return (
    <g className="geometry-preview-line">
      {segments.map((segment) => {
        const a = byId.get(segment.start)
        const b = byId.get(segment.end)
        if (!a || a.type !== 'point' || !b || b.type !== 'point') return null
        return <line key={segment.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--md-accent)" strokeWidth="2" strokeDasharray="6 4" />
      })}
    </g>
  )
}

export function GeometryPreviewLayers(props: Props): React.JSX.Element {
  const { selectionBox, polygonRubberFrom, polygonCursor, polygonFirstVertex, snapHint, arcDraftView, arcCursor, shapeKind, shapeAnchor, shapeCursor, ellipsePreview, segmentDraft } = props
  return (
    <>
      {selectionBox ? <rect className="geometry-selection-box" x={selectionBox.x} y={selectionBox.y} width={selectionBox.width} height={selectionBox.height} /> : null}
      {polygonRubberFrom && polygonCursor ? (
        <line className="geometry-preview-line" x1={polygonRubberFrom.x} y1={polygonRubberFrom.y} x2={polygonCursor.x} y2={polygonCursor.y} />
      ) : null}
      {polygonFirstVertex && polygonCursor ? <circle className="geometry-polygon-first-halo" cx={polygonFirstVertex.x} cy={polygonFirstVertex.y} r="9" /> : null}
      {snapHint ? <circle className="geometry-snap-halo" cx={snapHint.x} cy={snapHint.y} r="9" /> : null}
      {arcDraftView && arcCursor ? <ArcDraftPreview view={arcDraftView} cursor={arcCursor} /> : null}
      {shapeAnchor && shapeCursor ? <ShapeDraftPreview kind={shapeKind} anchor={shapeAnchor} cursor={shapeCursor} /> : null}
      {ellipsePreview ? <EllipseDraftPreview preview={ellipsePreview} /> : null}
      {segmentDraft ? (
        <>
          <line className="geometry-preview-line" x1={segmentDraft.start.x} y1={segmentDraft.start.y} x2={segmentDraft.cursor.x} y2={segmentDraft.cursor.y} />
          <circle className="geometry-snap-halo" cx={segmentDraft.start.x} cy={segmentDraft.start.y} r="5" />
        </>
      ) : null}
    </>
  )
}

function EllipseDraftPreview({ preview }: { preview: NonNullable<Props['ellipsePreview']> }): React.JSX.Element {
  let withA = addPoint(createGeometryDocument(), preview.focusA.x, preview.focusA.y)
  withA = addPoint(withA, preview.focusB.x, preview.focusB.y)
  withA = addEllipse(withA, 'P1', 'P2', preview.semiMajor)
  const ellipse = getGeometryObjects(withA, 'ellipse')[0]
  if (!ellipse || ellipse.type !== 'ellipse') return <></>
  const geometry = resolveEllipseGeometry(withA, ellipse)
  if (!geometry) return <></>
  return <ellipse className="geometry-preview-line" cx={geometry.center.x} cy={geometry.center.y} rx={geometry.radiusX} ry={geometry.radiusY} transform={`rotate(${geometry.rotation * 180 / Math.PI} ${geometry.center.x} ${geometry.center.y})`} fill="none" />
}

export function findPoint(document: GeometryDocument, id: string | undefined): Point | null {
  if (!id) return null
  const point = getGeometryObject(document, id)
  return point && point.type === 'point' ? { x: point.x, y: point.y } : null
}

export type { Point, Box }

import { getArcAngles, resolveEllipseGeometry, resolvePoint, type GeometryDocument, type GeometryToolId } from '../../geometry'

type MouseEventOf = React.MouseEvent<SVGElement>

type Props = {
  document: GeometryDocument
  tool: GeometryToolId
  selectedId: string | null
  polygonVertexIds: readonly string[]
  constructionTool: boolean
  onSelectForConstruction: (id: string, event: MouseEventOf) => void
  onSelectObject: (id: string, event: MouseEventOf) => void
  onPointMouseDown: (id: string, event: React.MouseEvent<SVGCircleElement>) => void
  onGrabRigid: (pointIds: string[], event: MouseEventOf) => void
  onSegmentEndpointPress: (segmentId: string, endpoint: 'start' | 'end', event: MouseEventOf) => void
  onStartCircleResize: (id: string, event: MouseEventOf) => void
  onStartArcHandleDrag: (id: string, kind: 'start' | 'end' | 'radius', event: MouseEventOf) => void
  onDerivedPointClick: (id: string, event: React.MouseEvent<SVGCircleElement>) => void
}

const SELECTED_COLOR = '#cf222e'
const DEFAULT_COLOR = '#24292f'
const HANDLE_COLOR = '#0969da'

function isPolygonDraftEdge(props: Props, startId: string, endId: string): boolean {
  return props.tool === 'polygon' && props.polygonVertexIds.includes(startId) && props.polygonVertexIds.includes(endId)
}

function PointObject(props: Props & { id: string; x: number; y: number; label?: string }): React.JSX.Element {
  const { id, x, y, label } = props
  return (
    <g key={id}>
      <circle
        cx={x}
        cy={y}
        r="5"
        fill={props.selectedId === id ? SELECTED_COLOR : HANDLE_COLOR}
        onClick={(event) => props.onSelectForConstruction(id, event)}
        onMouseDown={(event) => props.onPointMouseDown(id, event)}
      />
      <text x={x + 8} y={y - 8} pointerEvents="none">
        {label}
      </text>
    </g>
  )
}

function TextObject(props: Props & { id: string; x: number; y: number; text: string }): React.JSX.Element {
  const { id, x, y, text } = props
  return <text key={id} x={x} y={y} fill={props.selectedId === id ? SELECTED_COLOR : DEFAULT_COLOR} onClick={(event) => props.onSelectObject(id, event)}>{text}</text>
}

function CircleObject(props: Props & { id: string; centerId: string; radius: number }): React.JSX.Element | null {
  const { document, id, centerId, radius } = props
  const center = resolvePoint(document, centerId)
  if (!center) return null
  return (
    <g key={id}>
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke={props.selectedId === id ? SELECTED_COLOR : DEFAULT_COLOR}
        strokeWidth="2"
        onClick={(event) => props.onSelectObject(id, event)}
        onMouseDown={(event) => props.onGrabRigid([centerId], event)}
      />
      <circle data-handle="" cx={center.x + radius} cy={center.y} r="6" fill={props.selectedId === id ? SELECTED_COLOR : HANDLE_COLOR} cursor="ew-resize" onMouseDown={(event) => props.onStartCircleResize(id, event)} />
    </g>
  )
}

function SegmentObject(props: Props & { id: string; startId: string; endId: string }): React.JSX.Element | null {
  const { document, id, startId, endId } = props
  const start = document.objects.find((item) => item.type === 'point' && item.id === startId)
  const end = document.objects.find((item) => item.type === 'point' && item.id === endId)
  if (!(start && end && start.type === 'point' && end.type === 'point')) return null
  const select = (pointId: string) => (event: React.MouseEvent<SVGCircleElement>) => (props.constructionTool ? props.onSelectForConstruction(pointId, event) : props.onSelectObject(pointId, event))
  if (isPolygonDraftEdge(props, startId, endId)) {
    return (
      <g key={id}>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={DEFAULT_COLOR} strokeWidth="2" pointerEvents="none" />
      </g>
    )
  }
  return (
    <g key={id}>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={props.selectedId === id ? SELECTED_COLOR : DEFAULT_COLOR}
        strokeWidth="2"
        onClick={(event) => (props.constructionTool ? props.onSelectForConstruction(id, event) : props.onSelectObject(id, event))}
        onMouseDown={(event) => props.onGrabRigid([startId, endId], event)}
      />
      <circle data-handle="" cx={start.x} cy={start.y} r="7" fill="transparent" stroke={HANDLE_COLOR} strokeWidth="1" cursor="move" onClick={select(startId)} onMouseDown={(event) => props.onSegmentEndpointPress(id, 'start', event)} />
      <circle data-handle="" cx={end.x} cy={end.y} r="7" fill="transparent" stroke={HANDLE_COLOR} strokeWidth="1" cursor="move" onClick={select(endId)} onMouseDown={(event) => props.onSegmentEndpointPress(id, 'end', event)} />
    </g>
  )
}

function ArcObject(props: Props & { id: string; centerId: string; radius: number }): React.JSX.Element | null {
  const { document, id, centerId, radius } = props
  const arc = document.objects.find((item) => item.id === id)
  if (!arc || arc.type !== 'arc') return null
  const center = resolvePoint(document, centerId)
  if (!center) return null
  const angles = getArcAngles(document, arc)
  const sx = center.x + radius * Math.cos(angles.startAngle)
  const sy = center.y + radius * Math.sin(angles.startAngle)
  const ex = center.x + radius * Math.cos(angles.endAngle)
  const ey = center.y + radius * Math.sin(angles.endAngle)
  const twoPi = Math.PI * 2
  const span = ((angles.endAngle - angles.startAngle) % twoPi + twoPi) % twoPi
  const mx = center.x + radius * Math.cos(arc.startAngle + span / 2)
  const my = center.y + radius * Math.sin(arc.startAngle + span / 2)
  return (
    <g key={id}>
      <path
        d={`M ${sx} ${sy} A ${radius} ${radius} 0 ${span > Math.PI ? 1 : 0} 1 ${ex} ${ey}`}
        fill="none"
        stroke={props.selectedId === id ? SELECTED_COLOR : DEFAULT_COLOR}
        strokeWidth="2"
        onClick={(event) => props.onSelectObject(id, event)}
        onMouseDown={(event) => props.onGrabRigid([centerId], event)}
      />
      <circle data-handle="" cx={sx} cy={sy} r="6" fill={HANDLE_COLOR} cursor="grab" onMouseDown={(event) => props.onStartArcHandleDrag(id, 'start', event)} />
      <circle data-handle="" cx={ex} cy={ey} r="6" fill={HANDLE_COLOR} cursor="grab" onMouseDown={(event) => props.onStartArcHandleDrag(id, 'end', event)} />
      <circle data-handle="" cx={mx} cy={my} r="6" fill={HANDLE_COLOR} cursor="move" onMouseDown={(event) => props.onStartArcHandleDrag(id, 'radius', event)} />
    </g>
  )
}

function EllipseObject(props: Props & { id: string; focusA: string; focusB: string; semiMajor: number }): React.JSX.Element | null {
  const { document, id, focusA, focusB } = props
  const ellipse = document.objects.find((object) => object.id === id)
  if (!ellipse || ellipse.type !== 'ellipse') return null
  const geometry = resolveEllipseGeometry(document, ellipse)
  if (!geometry) return null
  const degrees = (geometry.rotation * 180) / Math.PI
  return (
    <ellipse
      key={id}
      cx={geometry.center.x}
      cy={geometry.center.y}
      rx={geometry.radiusX}
      ry={geometry.radiusY}
      transform={`rotate(${degrees} ${geometry.center.x} ${geometry.center.y})`}
      fill="none"
      stroke={props.selectedId === id ? SELECTED_COLOR : DEFAULT_COLOR}
      strokeWidth="2"
      onClick={(event) => props.onSelectObject(id, event)}
      onMouseDown={(event) => props.onGrabRigid([focusA, focusB], event)}
    />
  )
}

function DerivedPointObject(props: Props & { id: string }): React.JSX.Element | null {
  const { document, id } = props
  const point = resolvePoint(document, id)
  if (!point) return null
  return <circle key={id} cx={point.x} cy={point.y} r="4" fill={SELECTED_COLOR} onClick={(event) => props.onDerivedPointClick(id, event)} />
}

export function GeometryObjects(props: Props): React.JSX.Element {
  const { document } = props
  return (
    <>
      {document.objects.map((object) => {
        switch (object.type) {
          case 'point':
            return <PointObject key={object.id} {...props} id={object.id} x={object.x} y={object.y} label={object.label} />
          case 'text':
            return <TextObject key={object.id} {...props} id={object.id} x={object.x} y={object.y} text={object.text} />
          case 'circle':
            return <CircleObject key={object.id} {...props} id={object.id} centerId={object.center} radius={object.radius} />
          case 'segment':
            return <SegmentObject key={object.id} {...props} id={object.id} startId={object.start} endId={object.end} />
          case 'arc':
            return <ArcObject key={object.id} {...props} id={object.id} centerId={object.center} radius={object.radius} />
          case 'ellipse':
            return <EllipseObject key={object.id} {...props} id={object.id} focusA={object.focusA} focusB={object.focusB} semiMajor={object.semiMajor} />
          default:
            return <DerivedPointObject key={object.id} {...props} id={object.id} />
        }
      })}
    </>
  )
}

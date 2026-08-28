import { findConstrainedShapeCycle, findPolygonCycle, getArcAngles, getGeometryObject, getGeometryObjects, isSimpleCycle, polygonCycleSegmentIds, resolveEllipseGeometry, resolvePoint, type GeometryDocument, type GeometryToolId } from '../../geometry'

type MouseEventOf = React.MouseEvent<SVGElement>

type Props = {
  document: GeometryDocument
  tool: GeometryToolId
  selectedIds: readonly string[]
  polygonVertexIds: readonly string[]
  constructionTool: boolean
  onSelectForConstruction: (id: string, event: MouseEventOf) => void
  onSelectObject: (id: string, event: MouseEventOf) => void
  onPointMouseDown: (id: string, event: React.MouseEvent<SVGCircleElement>) => void
  onAttachedPointMouseDown: (id: string, event: React.MouseEvent<SVGCircleElement>) => void
  onPointOnSegment: (id: string, event: React.MouseEvent<SVGElement>) => void
  onGrabRigid: (pointIds: string[], event: MouseEventOf) => void
  onShapeEdgeDrag: (segmentId: string, event: MouseEventOf) => boolean
  onCurveResize: (id: string, event: MouseEventOf) => boolean
  onSegmentEndpointPress: (segmentId: string, endpoint: 'start' | 'end', event: MouseEventOf) => void
  onStartCircleResize: (id: string, event: MouseEventOf) => void
  onStartArcHandleDrag: (id: string, kind: 'start' | 'end' | 'radius', event: MouseEventOf) => void
  onSelectArcEndpoint: (id: string, kind: 'start' | 'end', event: MouseEventOf) => void
  onStartEllipseResize: (id: string, event: React.MouseEvent<SVGCircleElement>) => void
  onSelectPolygon: (vertexIds: string[], event: MouseEventOf) => void
  onTextMouseDown: (id: string, event: React.MouseEvent<SVGTextElement>) => void
  onTextRotateMouseDown: (id: string, event: React.MouseEvent<SVGTextElement>) => void
}

const SELECTED_COLOR = '#cf222e'
const DEFAULT_COLOR = '#24292f'
const HANDLE_COLOR = '#0969da'

function isPolygonDraftEdge(props: Props, startId: string, endId: string): boolean {
  return props.tool === 'polygon' && props.polygonVertexIds.includes(startId) && props.polygonVertexIds.includes(endId)
}

function PolygonHitAreas(props: Props): React.JSX.Element {
  const seen = new Set<string>()
  const cycles: string[][] = []
  for (const object of getGeometryObjects(props.document, 'point')) {
    const cycle = findConstrainedShapeCycle(props.document, object.id) ?? findPolygonCycle(props.document, object.id)
    if (!cycle || !isSimpleCycle(props.document, cycle)) continue
    const key = [...cycle].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    cycles.push(cycle)
  }
  return <>{cycles.map((cycle) => {
    const points = cycle.map((id) => resolvePoint(props.document, id)).filter((point): point is { x: number; y: number } => Boolean(point))
    if (points.length !== cycle.length) return null
    const selected = cycle.some((id) => props.selectedIds.includes(id))
    const edgeIds = polygonCycleSegmentIds(props.document, cycle)
    const selectedEdge = edgeIds.some((id) => props.selectedIds.includes(id))
    return <polygon
      key={cycle.join('|')}
      points={points.map((point) => `${point.x},${point.y}`).join(' ')}
      fill={selected || selectedEdge ? 'color-mix(in srgb, #cf222e 12%, transparent)' : 'transparent'}
      stroke="none"
      pointerEvents="fill"
      onClick={(event) => props.onSelectPolygon(cycle, event)}
       onMouseDown={(event) => {
         event.stopPropagation()
         props.onGrabRigid(cycle, event)
       }}
    />
  })}</>
}

function PointObject(props: Props & { id: string; x: number; y: number; label?: string }): React.JSX.Element {
  const { id, x, y, label } = props
  const point = props.document.points.find((item) => item.id === id)
  return (
    <g key={id}>
      {props.document.points.find((point) => point.id === id)?.attachment?.kind && props.document.points.find((point) => point.id === id)?.attachment?.kind !== 'segment' ? (
        <circle
          className="geometry-attachment-hit-area"
          cx={x}
          cy={y}
          r="10"
          fill="transparent"
          pointerEvents="all"
          onMouseDown={(event) => props.onAttachedPointMouseDown(id, event)}
        />
      ) : null}
      <circle
        cx={x}
        cy={y}
        r={point?.size ?? 5}
        data-attachment-kind={props.document.points.find((point) => point.id === id)?.attachment?.kind}
        fill={props.selectedIds.includes(id) ? SELECTED_COLOR : point?.color ?? HANDLE_COLOR}
        onClick={(event) => props.onSelectForConstruction(id, event)}
        onMouseDown={(event) => props.document.points.find((point) => point.id === id)?.attachment ? props.onAttachedPointMouseDown(id, event) : props.onPointMouseDown(id, event)}
      />
      <text x={x + 8} y={y - 8} pointerEvents="none">
        {label}
      </text>
    </g>
  )
}

function TextObject(props: Props & { id: string; x: number; y: number; text: string; fontSize?: number; color?: string; rotation?: number; anchor?: { objectId: string; t: number; offsetX: number; offsetY: number } }): React.JSX.Element {
  const { id, text } = props
  const anchor = props.anchor
  const segment = anchor ? getGeometryObject(props.document, anchor.objectId) : null
  const start = segment?.type === 'segment' ? resolvePoint(props.document, segment.start) : null
  const end = segment?.type === 'segment' ? resolvePoint(props.document, segment.end) : null
  const x = start && end && anchor ? start.x + (end.x - start.x) * anchor.t + anchor.offsetX : props.x
  const y = start && end && anchor ? start.y + (end.y - start.y) * anchor.t + anchor.offsetY : props.y
  return <text key={id} x={x} y={y} fill={props.selectedIds.includes(id) ? SELECTED_COLOR : props.color ?? DEFAULT_COLOR} fontSize={props.fontSize ?? 14} transform={props.rotation ? `rotate(${props.rotation} ${x} ${y})` : undefined} onClick={(event) => props.onSelectObject(id, event)} onMouseDown={(event) => (props.tool === 'rotate' ? props.onTextRotateMouseDown(id, event) : props.onTextMouseDown(id, event))}>{text}</text>
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
         stroke={props.selectedIds.includes(id) ? SELECTED_COLOR : DEFAULT_COLOR}
        strokeWidth="2"
        onClick={(event) => props.tool === 'point' ? props.onPointOnSegment(id, event) : props.onSelectObject(id, event)}
         onMouseDown={(event) => {
           if (props.tool === 'move') event.stopPropagation()
           props.onGrabRigid([centerId], event)
          }}
      />
      <circle
        data-handle=""
        className="geometry-handle-center"
        cx={center.x}
        cy={center.y}
        r="8"
        fill="transparent"
        pointerEvents="all"
        onClick={(event) => props.onSelectObject(centerId, event)}
        onMouseDown={(event) => props.onGrabRigid([centerId], event)}
      />
       <circle data-handle="" className="geometry-handle-radius" cx={center.x + radius} cy={center.y} r="6" fill={props.selectedIds.includes(id) ? SELECTED_COLOR : HANDLE_COLOR} onMouseDown={(event) => props.onStartCircleResize(id, event)} />
    </g>
  )
}

function SegmentObject(props: Props & { id: string; startId: string; endId: string }): React.JSX.Element | null {
  const { document, id, startId, endId } = props
  const start = getGeometryObject(document, startId)
  const end = getGeometryObject(document, endId)
  if (!(start && end && start.type === 'point' && end.type === 'point')) return null
  const segment = document.segments.find((item) => item.id === id)
  const dasharray = segment?.lineStyle === 'dashed' ? '8 6' : segment?.lineStyle === 'dotted' ? '2 5' : undefined
  const select = (pointId: string) => (event: React.MouseEvent<SVGCircleElement>) => (props.constructionTool ? props.onSelectForConstruction(pointId, event) : props.onSelectObject(pointId, event))
  if (isPolygonDraftEdge(props, startId, endId)) {
    return (
      <g key={id}>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={segment?.color ?? DEFAULT_COLOR} strokeWidth={segment?.lineWidth ?? 2} strokeDasharray={dasharray} pointerEvents="none" />
      </g>
    )
  }
  const handleClick = (event: React.MouseEvent<SVGElement>): void => {
    if (props.tool === 'point') {
      props.onPointOnSegment(id, event)
      return
    }
    if (props.constructionTool) {
      event.stopPropagation()
      props.onSelectForConstruction(id, event)
      return
    }
    props.onSelectObject(id, event)
  }
  const handleMouseDown = (event: React.MouseEvent<SVGElement>): void => {
    if (props.constructionTool) {
      event.stopPropagation()
      return
    }
    if (props.tool === 'move') {
      event.stopPropagation()
      props.onGrabRigid([startId, endId], event)
      return
    }
    if (props.tool === 'select' && props.onShapeEdgeDrag(id, event)) {
      event.stopPropagation()
      props.onSelectObject(id, event)
      return
    }
    if (props.tool === 'select') props.onSelectObject(id, event)
    props.onGrabRigid([startId, endId], event)
  }
  return (
    <g key={id}>
       <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
          stroke={props.selectedIds.includes(id) ? SELECTED_COLOR : segment?.color ?? DEFAULT_COLOR}
         strokeWidth={segment?.lineWidth ?? 2}
         strokeDasharray={dasharray}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
       />
       <path
         className="geometry-hit-area"
         d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
       />
       <circle data-handle="" cx={start.x} cy={start.y} r="7" fill="transparent" stroke={HANDLE_COLOR} strokeWidth="1" cursor="move" onClick={select(startId)} onMouseDown={(event) => props.onSegmentEndpointPress(id, 'start', event)} />
      <circle data-handle="" cx={end.x} cy={end.y} r="7" fill="transparent" stroke={HANDLE_COLOR} strokeWidth="1" cursor="move" onClick={select(endId)} onMouseDown={(event) => props.onSegmentEndpointPress(id, 'end', event)} />
    </g>
  )
}

function ArcObject(props: Props & { id: string; centerId: string; radius: number }): React.JSX.Element | null {
  const { document, id, centerId, radius } = props
  const arc = getGeometryObject(document, id)
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
         stroke={props.selectedIds.includes(id) ? SELECTED_COLOR : DEFAULT_COLOR}
        strokeWidth="2"
        onClick={(event) => props.tool === 'point' ? props.onPointOnSegment(id, event) : props.onSelectObject(id, event)}
         onMouseDown={(event) => {
           if (props.tool === 'move') {
             event.stopPropagation()
             props.onGrabRigid([centerId], event)
             return
           }
           if (!(props.tool === 'select' && props.onCurveResize(id, event))) props.onGrabRigid([centerId], event)
         }}
       />
       <circle
         data-handle=""
         className="geometry-handle-center"
         cx={center.x}
         cy={center.y}
         r="8"
         fill="transparent"
         pointerEvents="all"
         onClick={(event) => props.onSelectObject(centerId, event)}
         onMouseDown={(event) => props.onGrabRigid([centerId], event)}
       />
       <circle data-handle="" className="geometry-handle-endpoint" cx={sx} cy={sy} r="6" fill={HANDLE_COLOR} onMouseDown={(event) => props.tool === 'select' || props.tool === 'point' ? props.onStartArcHandleDrag(id, 'start', event) : props.onSelectArcEndpoint(id, 'start', event)} />
       <circle data-handle="" className="geometry-handle-endpoint" cx={ex} cy={ey} r="6" fill={HANDLE_COLOR} onMouseDown={(event) => props.tool === 'select' || props.tool === 'point' ? props.onStartArcHandleDrag(id, 'end', event) : props.onSelectArcEndpoint(id, 'end', event)} />
       <circle data-handle="" className="geometry-handle-radius" cx={mx} cy={my} r="6" fill={HANDLE_COLOR} onMouseDown={(event) => props.onStartArcHandleDrag(id, 'radius', event)} />
    </g>
  )
}

function EllipseObject(props: Props & { id: string; focusA: string; focusB: string; semiMajor: number }): React.JSX.Element | null {
  const { document, id, focusA, focusB } = props
  const ellipse = getGeometryObject(document, id)
  if (!ellipse || ellipse.type !== 'ellipse') return null
  const geometry = resolveEllipseGeometry(document, ellipse)
  if (!geometry) return null
  const degrees = (geometry.rotation * 180) / Math.PI
  const handleX = geometry.center.x + geometry.radiusX * Math.cos(geometry.rotation)
  const handleY = geometry.center.y + geometry.radiusX * Math.sin(geometry.rotation)
  return (
    <g key={id}>
    <ellipse
      key={id}
      cx={geometry.center.x}
      cy={geometry.center.y}
      rx={geometry.radiusX}
      ry={geometry.radiusY}
      transform={`rotate(${degrees} ${geometry.center.x} ${geometry.center.y})`}
      fill="none"
       stroke={props.selectedIds.includes(id) ? SELECTED_COLOR : DEFAULT_COLOR}
      strokeWidth="2"
       onClick={(event) => props.tool === 'point' ? props.onPointOnSegment(id, event) : props.onSelectObject(id, event)}
       onMouseDown={(event) => {
         if (props.tool === 'move') {
           event.stopPropagation()
           props.onGrabRigid([focusA, focusB], event)
           return
         }
         if (!(props.tool === 'select' && props.onCurveResize(id, event))) props.onGrabRigid([focusA, focusB], event)
       }}
    />
     <circle data-handle="" className="geometry-handle-scale" cx={handleX} cy={handleY} r="6" fill={props.selectedIds.includes(id) ? SELECTED_COLOR : HANDLE_COLOR} onMouseDown={(event) => props.onStartEllipseResize(id, event)} />
    </g>
  )
}

export function GeometryObjects(props: Props): React.JSX.Element {
  const { document } = props
  return (
    <>
      <PolygonHitAreas {...props} />
      {[...getGeometryObjects(document, 'text'), ...getGeometryObjects(document, 'circle'), ...getGeometryObjects(document, 'segment'), ...getGeometryObjects(document, 'arc'), ...getGeometryObjects(document, 'ellipse'), ...getGeometryObjects(document, 'point')].map((object) => {
        switch (object.type) {
          case 'point':
            return <PointObject key={object.id} {...props} id={object.id} x={object.x} y={object.y} label={object.label} />
          case 'text':
            return <TextObject key={object.id} {...props} id={object.id} x={object.x} y={object.y} text={object.text} fontSize={object.fontSize} color={object.color} rotation={object.rotation} anchor={object.anchor} />
          case 'circle':
            return <CircleObject key={object.id} {...props} id={object.id} centerId={object.center} radius={object.radius} />
          case 'segment':
            return <SegmentObject key={object.id} {...props} id={object.id} startId={object.start} endId={object.end} />
          case 'arc':
            return <ArcObject key={object.id} {...props} id={object.id} centerId={object.center} radius={object.radius} />
          case 'ellipse':
            return <EllipseObject key={object.id} {...props} id={object.id} focusA={object.focusA} focusB={object.focusB} semiMajor={object.semiMajor} />
           default:
             return null
        }
      })}
    </>
  )
}

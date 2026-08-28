import { evaluateConstraints, findPolygonCycle, GEOMETRY_UNITS_PER_CM, getGeometryObject, getGeometryObjects, movePoint, removeConstraint, resolvePoint, solveGeometry, type GeometryArc, type GeometryDocument } from '../../geometry'
import { getArcAngles } from '../../geometry/core/calculations'
import { getVertexAngle } from '../../geometry/core/polygonGuard'
import type { GeometryConstraint } from '../../geometry/core/constraints'
import { useI18n, type TranslationKey } from '../../i18n'
import { deleteObjects, setArcProperties, setCircleRadius, setEllipseSemiMajor, setPointCoordinates, setPointLabel, setPointStyle, setSegmentLength, setSegmentStyle, setTextAnchor, setTextStyle, setTextValue, setVertexAngle } from '../../geometry/core/propertyCommands'

type Props = {
  document: GeometryDocument
  selectedIds: string[]
  commit: (next: GeometryDocument) => void
  onClearSelection: () => void
}

const CONSTRAINT_LABEL_KEYS: Record<string, TranslationKey> = {
  coincident: 'geometryCoincident',
  horizontal: 'geometryHorizontal',
  vertical: 'geometryVerticalEdge',
  parallel: 'geometryParallel',
  perpendicular: 'geometryPerpendicular',
  equalLength: 'geometryEqualLength',
  pointOnLine: 'geometryPointOnLine',
  fixedDistance: 'geometryFixedDistance',
  fixedAngle: 'geometryAngle',
  tangent: 'geometryTangent',
  symmetric: 'geometrySymmetric'
}

function absoluteAngleDegrees(radians: number): number {
  return Math.round(Math.abs((radians * 180) / Math.PI))
}

function selectedReferenceIds(document: GeometryDocument, selectedIds: readonly string[]): Set<string> {
  const references = new Set(selectedIds)
  for (const object of [...getGeometryObjects(document, 'segment')]) {
    if (object.type === 'segment' && (selectedIds.includes(object.start) || selectedIds.includes(object.end))) references.add(object.id)
  }
  return references
}

function InspectorSummary({ document, selectedIds, commit, onClearSelection }: Props): React.JSX.Element | null {
  const { t } = useI18n()
  if (!selectedIds.length) return null
  const primary = getGeometryObject(document, selectedIds[0])
  const singlePoint = selectedIds.length === 1 && primary?.type === 'point' ? primary : null
  const polygon = selectedIds.length > 2 && primary?.type === 'point' ? findPolygonCycle(document, primary.id) : null
  const polygonSelected = polygon && polygon.every((id) => selectedIds.includes(id))
  const polygonPoints = polygonSelected ? polygon.map((id) => resolvePoint(document, id)).filter((point): point is { x: number; y: number } => Boolean(point)) : []
  const polygonArea = polygonPoints.reduce((sum, point, index) => {
    const next = polygonPoints[(index + 1) % polygonPoints.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0)
  const polygonPerimeter = polygonPoints.reduce((sum, point, index) => {
    const next = polygonPoints[(index + 1) % polygonPoints.length]
    return sum + Math.hypot(next.x - point.x, next.y - point.y)
  }, 0)
  const title = selectedIds.length > 1 ? t('geometrySelectedCount', { count: String(selectedIds.length) }) : primary?.type === 'point' && primary.label ? primary.label : selectedIds[0]
  const references = selectedReferenceIds(document, selectedIds)
  const selectedConstraints = document.constraints.filter((constraint) => Object.values(constraint).some((value) => typeof value === 'string' && references.has(value)))
  const allSatisfied = !evaluateConstraints(document, selectedConstraints).some((result) => !result.valid)
  return (
    <aside className="geometry-inspector">
      <strong>{title}</strong>
      <span>
        {t('geometryType')}: {primary?.type ?? ''}
      </span>
      {singlePoint ? (
        <>
          <label>
            {t('geometryName')}{' '}
            <input
              aria-label={t('geometryName')}
              type="text"
              value={singlePoint.label ?? ''}
              placeholder={singlePoint.id}
              onChange={(event) =>
                commit(setPointLabel(document, singlePoint.id, event.target.value))
              }
            />
          </label>
          <label>
            X{' '}
            <input aria-label="X" type="number" value={singlePoint.x} onChange={(event) => commit(setPointCoordinates(document, singlePoint.id, Number(event.target.value), singlePoint.y))} />
          </label>
          <label>
            Y{' '}
            <input aria-label="Y" type="number" value={singlePoint.y} onChange={(event) => commit(setPointCoordinates(document, singlePoint.id, singlePoint.x, Number(event.target.value)))} />
          </label>
          <VertexAngleField document={document} pointId={singlePoint.id} commit={commit} />
          <CircleRadiiFields document={document} pointId={singlePoint.id} commit={commit} />
          <PointStyleFields document={document} pointId={singlePoint.id} commit={commit} />
        </>
      ) : null}
      {polygonSelected ? (
        <>
          <span>{t('geometryPolygonVertices')}: {polygon.length}</span>
          <span>{t('geometryPolygonEdges')}: {polygon.length}</span>
          <span>{t('geometryPolygonArea')}: {Math.abs(polygonArea / 2).toFixed(2)}</span>
          <span>{t('geometryPolygonPerimeter')}: {polygonPerimeter.toFixed(2)}</span>
        </>
      ) : null}
      <span>
        {t('geometryConstraintStatus')}: {allSatisfied ? t('geometrySatisfied') : t('geometryUnsatisfied')}
      </span>
      <button
        type="button"
        onClick={() => {
          commit(deleteObjects(document, selectedIds))
          onClearSelection()
        }}
      >
        {t('geometryDeleteSelected')}
      </button>
    </aside>
  )
}

function VertexAngleField({ document, pointId, commit }: { document: GeometryDocument; pointId: string; commit: (next: GeometryDocument) => void }): React.JSX.Element | null {
  const { t } = useI18n()
  const info = getVertexAngle(document, pointId)
  if (!info) return null
  if (!info.editable) {
    return (
      <span>
        {t('geometryInteriorAngle')}: {Math.round(info.angleDeg)}°
      </span>
    )
  }
  const apply = (degrees: number): void => {
    if (!Number.isFinite(degrees) || degrees <= 0 || degrees >= 180) return
    const next = setVertexAngle(document, pointId, info.prevId, info.nextId, info.sign, degrees)
    commit(solveGeometry(next).document)
  }
  return (
    <label>
      {t('geometryInteriorAngle')}{' '}
      <input
        aria-label={t('geometryInteriorAngle')}
        type="number"
        min={1}
        max={179}
        defaultValue={Math.round(info.angleDeg)}
        onBlur={(event) => apply(Number(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') apply(Number((event.target as HTMLInputElement).value))
        }}
      />
    </label>
  )
}

function CircleRadiiFields({ document, pointId, commit }: { document: GeometryDocument; pointId: string; commit: (next: GeometryDocument) => void }): React.JSX.Element | null {
  const { t } = useI18n()
  const point = resolvePoint(document, pointId)
  if (!point) return null
  const entries = getGeometryObjects(document, 'circle').flatMap((object) => {
    const center = resolvePoint(document, object.center)
    if (!center) return []
    const distance = Math.hypot(point.x - center.x, point.y - center.y)
    if (object.center === pointId) return [{ circle: object, ringPointId: null as string | null }]
    if (Math.abs(distance - object.radius) <= 2) return [{ circle: object, ringPointId: pointId }]
    return []
  })
  if (!entries.length) return null
  const apply = (circleId: string, ringPointId: string | null, radius: number): void => {
    if (!Number.isFinite(radius) || radius <= 0) return
    let next = setCircleRadius(document, circleId, Math.max(1, radius))
    if (ringPointId) {
      const circle = getGeometryObject(next, circleId)
      if (circle && circle.type === 'circle') {
        const center = resolvePoint(next, circle.center)
        const moving = resolvePoint(next, ringPointId)
        if (center && moving) {
          const directionX = moving.x - center.x
          const directionY = moving.y - center.y
          const length = Math.hypot(directionX, directionY) || 1
          next = movePoint(next, ringPointId, center.x + (directionX / length) * circle.radius, center.y + (directionY / length) * circle.radius)
        }
      }
    }
    commit(solveGeometry(next).document)
  }
  return (
    <>
      {entries.map(({ circle, ringPointId }) => (
        <label key={circle.id}>
          {t('geometryRadius')}
          {entries.length > 1 ? ` (${circle.id})` : ''}{' '}
          <input
            aria-label={`${t('geometryRadius')}${entries.length > 1 ? `-${circle.id}` : ''}`}
            type="number"
            value={Math.round(circle.radius * 100) / 100}
            onChange={(event) => apply(circle.id, ringPointId, Number(event.target.value))}
          />
        </label>
      ))}
    </>
  )
}

function ObjectDetails({ document, selectedIds, commit }: Props): React.JSX.Element | null {
  const { t } = useI18n()
  if (selectedIds.length !== 1) return null
  const object = getGeometryObject(document, selectedIds[0])
  if (!object) return null
  const point = object.type === 'point' ? resolvePoint(document, object.id) : null
  const segment = object.type === 'segment' ? { start: resolvePoint(document, object.start), end: resolvePoint(document, object.end) } : null
  const length = segment?.start && segment.end ? Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) : null
  const center = object.type === 'circle' ? resolvePoint(document, object.center) : null

  const applySegmentLength = (segmentId: string, value: number): void => {
    const next = setSegmentLength(document, segmentId, value * GEOMETRY_UNITS_PER_CM)
    commit(solveGeometry(next).document)
  }

  return (
    <aside className="geometry-object-details">
      <strong>{object.id}</strong>
      {point ? (
        <span>
            {t('geometryCoordinates')}: {point.x.toFixed(2)} cm, {point.y.toFixed(2)} cm
        </span>
      ) : null}
      {length !== null ? (
        <label>
            <span>{t('geometryLength')}</span><span aria-hidden="true"> (cm)</span>{' '}
          <input
            aria-label={t('geometryLength')}
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={Math.round((length / GEOMETRY_UNITS_PER_CM) * 100) / 100}
            onBlur={(event) => applySegmentLength(object.id, Number(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applySegmentLength(object.id, Number((event.target as HTMLInputElement).value))
            }}
          />
        </label>
      ) : null}
      {object.type === 'segment' ? <SegmentStyleFields document={document} segmentId={object.id} commit={commit} /> : null}
      {center ? (
        <span>
          {t('geometryCenter')}: {center.x.toFixed(2)}, {center.y.toFixed(2)}
        </span>
      ) : null}
      {object.type === 'circle' ? (
        <label>
          <span>{t('geometryRadius')}</span><span aria-hidden="true"> (cm)</span> <input aria-label={t('geometryRadius')} type="number" min="0.01" step="0.01" value={Math.round((object.radius / GEOMETRY_UNITS_PER_CM) * 100) / 100} onChange={(event) => commit(setCircleRadius(document, object.id, Number(event.target.value) * GEOMETRY_UNITS_PER_CM))} />
        </label>
      ) : null}
      {object.type === 'ellipse' ? (
        <label>
          <span>{t('geometrySemiMajor')}</span><span aria-hidden="true"> (cm)</span> <input aria-label={t('geometrySemiMajor')} type="number" min="0.01" step="0.01" value={Math.round((object.semiMajor / GEOMETRY_UNITS_PER_CM) * 100) / 100} onChange={(event) => commit(setEllipseSemiMajor(document, object.id, Number(event.target.value) * GEOMETRY_UNITS_PER_CM))} />
        </label>
      ) : null}
      {object.type === 'arc' ? <ArcFields document={document} arcId={object.id} commit={commit} /> : null}
      {object.type === 'text' ? (
        <>
          <label>{t('geometryTextValue')}{' '}<input value={object.text} onChange={(event) => commit(setTextValue(document, object.id, event.target.value))} /></label>
          <label>{t('geometryFontSize')}{' '}<input aria-label={t('geometryFontSize')} type="number" min="1" value={object.fontSize ?? 14} onChange={(event) => commit(setTextStyle(document, object.id, { fontSize: Math.max(1, Number(event.target.value)) }))} /></label>
          <label>{t('geometryTextColor')}{' '}<input aria-label={t('geometryTextColor')} type="color" value={object.color ?? '#24292f'} onChange={(event) => commit(setTextStyle(document, object.id, { color: event.target.value }))} /></label>
          <label>{t('geometryTextRotation')}{' '}<input aria-label={t('geometryTextRotation')} type="number" value={object.rotation ?? 0} onChange={(event) => commit(setTextStyle(document, object.id, { rotation: Number(event.target.value) || 0 }))} /></label>
          <label>{t('geometryTextAnchor')}{' '}<select aria-label={t('geometryTextAnchor')} value={object.anchor?.objectId ?? ''} onChange={(event) => {
            const segment = getGeometryObject(document, event.target.value)
            if (!segment || segment.type !== 'segment') return commit(setTextAnchor(document, object.id, undefined))
            const start = resolvePoint(document, segment.start); const end = resolvePoint(document, segment.end)
            const lengthSquared = start && end ? Math.max(1e-12, (end.x - start.x) ** 2 + (end.y - start.y) ** 2) : 1
            const tValue = start && end ? Math.max(0, Math.min(1, ((object.x - start.x) * (end.x - start.x) + (object.y - start.y) * (end.y - start.y)) / lengthSquared)) : 0.5
            const anchorX = start && end ? start.x + (end.x - start.x) * tValue : object.x
            const anchorY = start && end ? start.y + (end.y - start.y) * tValue : object.y
            commit(setTextAnchor(document, object.id, { objectId: segment.id, t: tValue, offsetX: object.x - anchorX, offsetY: object.y - anchorY }))
          }}><option value="">{t('geometryTextUnanchored')}</option>{getGeometryObjects(document, 'segment').map((segment) => <option key={segment.id} value={segment.id}>{segment.id}</option>)}</select></label>
        </>
      ) : null}
    </aside>
  )
}

function PointStyleFields({ document, pointId, commit }: { document: GeometryDocument; pointId: string; commit: (next: GeometryDocument) => void }): React.JSX.Element {
  const { t } = useI18n()
  const point = getGeometryObject(document, pointId)
  if (!point || point.type !== 'point') return <></>
  return <>
    <label>{t('geometryColor')} <input aria-label={t('geometryColor')} type="color" value={point.color ?? '#0969da'} onChange={(event) => commit(setPointStyle(document, pointId, { color: event.target.value }))} /></label>
    <label>{t('geometryPointSize')} <input aria-label={t('geometryPointSize')} type="number" min="1" step="1" value={point.size ?? 5} onChange={(event) => commit(setPointStyle(document, pointId, { size: Math.max(1, Number(event.target.value) || 1) }))} /></label>
  </>
}

function SegmentStyleFields({ document, segmentId, commit }: { document: GeometryDocument; segmentId: string; commit: (next: GeometryDocument) => void }): React.JSX.Element {
  const { t } = useI18n()
  const segment = getGeometryObject(document, segmentId)
  if (!segment || segment.type !== 'segment') return <></>
  return <>
    <label>{t('geometryColor')} <input aria-label={t('geometryColor')} type="color" value={segment.color ?? '#24292f'} onChange={(event) => commit(setSegmentStyle(document, segmentId, { color: event.target.value }))} /></label>
    <label>{t('geometryLineWidth')} <input aria-label={t('geometryLineWidth')} type="number" min="0.25" step="0.25" value={segment.lineWidth ?? 2} onChange={(event) => commit(setSegmentStyle(document, segmentId, { lineWidth: Number(event.target.value) }))} /></label>
    <label>{t('geometryLineStyle')} <select aria-label={t('geometryLineStyle')} value={segment.lineStyle ?? 'solid'} onChange={(event) => commit(setSegmentStyle(document, segmentId, { lineStyle: event.target.value as 'solid' | 'dashed' | 'dotted' }))}><option value="solid">{t('geometryLineSolid')}</option><option value="dashed">{t('geometryLineDashed')}</option><option value="dotted">{t('geometryLineDotted')}</option></select></label>
  </>
}

function ArcFields({ document, arcId, commit }: { document: GeometryDocument; arcId: string; commit: (next: GeometryDocument) => void }): React.JSX.Element | null {
  const { t } = useI18n()
  const arc = getGeometryObject(document, arcId)
  if (!arc || arc.type !== 'arc') return null
  const angles = getArcAngles(document, arc)
  const setArc = (patch: Partial<GeometryArc>): void =>
    commit(setArcProperties(document, arc.id, patch))
  return (
    <>
      <label>
        <span>{t('geometryRadius')}</span><span aria-hidden="true"> (cm)</span>{' '}
        <input
          aria-label={t('geometryRadius')}
           type="number"
           min="0.01"
           step="0.01"
          value={Math.round((arc.radius / GEOMETRY_UNITS_PER_CM) * 100) / 100}
          onChange={(event) => setArc({ radius: Math.max(0.01, Number(event.target.value) * GEOMETRY_UNITS_PER_CM || 0.01) })}
        />
      </label>
      <label>
        {t('geometryStartAngle')}{' '}
        <input
          aria-label={t('geometryStartAngle')}
          type="number"
          value={Math.round((angles.startAngle * 180) / Math.PI)}
          onChange={(event) => setArc({ startAngle: (Number(event.target.value) * Math.PI) / 180, startAnchor: undefined })}
        />
      </label>
      <label>
        {t('geometryEndAngle')}{' '}
        <input
          aria-label={t('geometryEndAngle')}
          type="number"
          value={Math.round((angles.endAngle * 180) / Math.PI)}
          onChange={(event) => setArc({ endAngle: (Number(event.target.value) * Math.PI) / 180, endAnchor: undefined })}
        />
      </label>
    </>
  )
}

function ConstraintsList({ document, selectedIds, commit }: Props): React.JSX.Element | null {
  const { t } = useI18n()
  const references = selectedReferenceIds(document, selectedIds)
  const constraints = document.constraints.filter((constraint) => Object.values(constraint).some((value) => typeof value === 'string' && references.has(value)))
  if (!constraints.length) return null
  const label = (type: string): string => t(CONSTRAINT_LABEL_KEYS[type] ?? ('' as TranslationKey)) || type
  const pointLabel = (id: string): string => {
    const point = getGeometryObject(document, id)
    return point?.type === 'point' && point.label ? point.label : id
  }
  const objectLabel = (id: string): string => {
    const object = getGeometryObject(document, id)
    if (!object) return id
    if (object.type === 'segment') return `${pointLabel(object.start)}-${pointLabel(object.end)}`
    if (object.type === 'circle') return `${t('geometryCircle')} ${id}`
    if (object.type === 'arc') return `${t('geometryArc')} ${id}`
    if (object.type === 'point') return pointLabel(id)
    return id
  }
  const detail = (constraint: GeometryConstraint): string => {
    switch (constraint.type) {
      case 'coincident': return `${pointLabel(constraint.pointA)} = ${pointLabel(constraint.pointB)}`
      case 'horizontal':
      case 'vertical': return objectLabel(constraint.segment)
      case 'pointOnLine': return `${pointLabel(constraint.point)} ∈ ${objectLabel(constraint.line)}`
      case 'midpoint': return `${pointLabel(constraint.point)} = mid(${objectLabel(constraint.line)})`
      case 'intersection': return `${pointLabel(constraint.point)} ∈ ${objectLabel(constraint.lineA)} ∩ ${objectLabel(constraint.lineB)}`
      case 'parallel':
      case 'perpendicular': return `${objectLabel(constraint.lineA)} / ${objectLabel(constraint.lineB)}`
      case 'equalLength': return `${objectLabel(constraint.segmentA)} = ${objectLabel(constraint.segmentB)}`
       case 'fixedDistance': return `${pointLabel(constraint.a)}-${pointLabel(constraint.b)} = ${(constraint.value / GEOMETRY_UNITS_PER_CM).toFixed(2)} cm`
      case 'fixedAngle': return `∠${pointLabel(constraint.a)}${pointLabel(constraint.vertex)}${pointLabel(constraint.b)} = ${absoluteAngleDegrees(constraint.value)}°`
      case 'tangent': return `${objectLabel(constraint.curveA)} / ${objectLabel(constraint.curveB)}`
      case 'symmetric': return `${pointLabel(constraint.a)}, ${pointLabel(constraint.b)} ↔ ${objectLabel(constraint.mirror)}`
      default: return ''
    }
  }
  return (
    <aside className="geometry-constraints">
      <strong>{t('geometryConstraints')}</strong>
      {constraints.map((constraint) => {
        const index = document.constraints.indexOf(constraint)
        const result = evaluateConstraints(document, [constraint])[0]
        return (
          <div key={`${constraint.type}-${index}`} className={result.valid ? 'constraint-valid' : 'constraint-invalid'}>
            <span>
              <strong>{label(constraint.type)}</strong>{' '}
              <span className="geometry-constraint-detail">({detail(constraint)})</span>{' '}
              {result.valid ? t('geometrySatisfied') : result.message ?? t('geometryUnsatisfied')}
            </span>
            {constraint.type === 'fixedAngle' ? (
              <input
                aria-label={`${t('geometryAngle')}-${index}`}
                type="number"
                style={{ width: 64 }}
                value={absoluteAngleDegrees(constraint.value)}
                onChange={(event) => {
                  const degrees = Number(event.target.value)
                  if (!Number.isFinite(degrees)) return
                  const next = {
                    ...document,
                    constraints: document.constraints.map((item, current) => (current === index && item.type === 'fixedAngle' ? { ...item, value: (degrees * Math.PI) / 180 } : item))
                  }
                  commit(solveGeometry(next).document)
                }}
              />
            ) : null}
            <button type="button" onClick={() => commit(removeConstraint(document, index))}>
              {t('delete')}
            </button>
          </div>
        )
      })}
    </aside>
  )
}

export function GeometrySidePanel(props: Props): React.JSX.Element {
  const { t } = useI18n()
  const { selectedIds } = props
  return (
    <aside className="geometry-side">
      {selectedIds.length === 0 ? <div className="geometry-side-empty-hint">{t('geometrySideEmptyHint')}</div> : null}
      <InspectorSummary {...props} />
      <ObjectDetails {...props} />
      <ConstraintsList {...props} />
    </aside>
  )
}

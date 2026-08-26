import { evaluateConstraints, movePoint, removeConstraint, resolvePoint, solveGeometry, type GeometryArc, type GeometryDocument } from '../../geometry'
import { getArcAngles } from '../../geometry/core/calculations'
import { getVertexAngle } from '../../geometry/core/polygonGuard'
import { useI18n, type TranslationKey } from '../../i18n'
import { deleteObjects, setArcProperties, setCircleRadius, setEllipseSemiMajor, setPointCoordinates, setPointLabel, setSegmentLength, setTextValue, setVertexAngle } from '../../geometry/core/propertyCommands'

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

function InspectorSummary({ document, selectedIds, commit, onClearSelection }: Props): React.JSX.Element | null {
  const { t } = useI18n()
  if (!selectedIds.length) return null
  const primary = document.objects.find((object) => object.id === selectedIds[0])
  const singlePoint = selectedIds.length === 1 && primary?.type === 'point' ? primary : null
  const title = selectedIds.length > 1 ? t('geometrySelectedCount', { count: String(selectedIds.length) }) : primary?.type === 'point' && primary.label ? primary.label : selectedIds[0]
  const allSatisfied = !evaluateConstraints(document, document.constraints).some((result) => !result.valid)
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
  const entries = document.objects.flatMap((object) => {
    if (object.type !== 'circle') return []
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
      const circle = next.objects.find((object) => object.id === circleId)
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
  const object = document.objects.find((item) => item.id === selectedIds[0])
  if (!object) return null
  const point = object.type === 'point' ? resolvePoint(document, object.id) : null
  const segment = object.type === 'segment' ? { start: resolvePoint(document, object.start), end: resolvePoint(document, object.end) } : null
  const length = segment?.start && segment.end ? Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) : null
  const center = object.type === 'circle' ? resolvePoint(document, object.center) : null
  const dependency =
    object.type === 'midpoint' ? `${object.a}, ${object.b}` : object.type === 'intersection' ? `${object.lineA}, ${object.lineB}` : object.type === 'perpendicularFoot' ? `${object.point}, ${object.line}` : null

  const applySegmentLength = (segmentId: string, value: number): void => {
    const next = setSegmentLength(document, segmentId, value)
    commit(solveGeometry(next).document)
  }

  return (
    <aside className="geometry-object-details">
      <strong>{object.id}</strong>
      {point ? (
        <span>
          {t('geometryCoordinates')}: {point.x.toFixed(2)}, {point.y.toFixed(2)}
        </span>
      ) : null}
      {length !== null ? (
        <label>
          {t('geometryLength')}{' '}
          <input
            aria-label={t('geometryLength')}
            type="number"
            defaultValue={Math.round(length * 100) / 100}
            onBlur={(event) => applySegmentLength(object.id, Number(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applySegmentLength(object.id, Number((event.target as HTMLInputElement).value))
            }}
          />
        </label>
      ) : null}
      {center ? (
        <span>
          {t('geometryCenter')}: {center.x.toFixed(2)}, {center.y.toFixed(2)}
        </span>
      ) : null}
      {object.type === 'circle' ? (
        <label>
          {t('geometryRadius')} <input type="number" value={object.radius} onChange={(event) => commit(setCircleRadius(document, object.id, Number(event.target.value)))} />
        </label>
      ) : null}
      {object.type === 'ellipse' ? (
        <label>
          {t('geometrySemiMajor')} <input aria-label={t('geometrySemiMajor')} type="number" min="1" value={object.semiMajor} onChange={(event) => commit(setEllipseSemiMajor(document, object.id, Number(event.target.value)))} />
        </label>
      ) : null}
      {object.type === 'arc' ? <ArcFields document={document} arcId={object.id} commit={commit} /> : null}
      {object.type === 'text' ? (
        <label>
          {t('geometryTextValue')}{' '}
          <input
            value={object.text}
            onChange={(event) =>
              commit(setTextValue(document, object.id, event.target.value))
            }
          />
        </label>
      ) : null}
      {dependency ? (
        <span>
          {t('geometryDependencies')}: {dependency}
        </span>
      ) : null}
    </aside>
  )
}

function ArcFields({ document, arcId, commit }: { document: GeometryDocument; arcId: string; commit: (next: GeometryDocument) => void }): React.JSX.Element | null {
  const { t } = useI18n()
  const arc = document.objects.find((item) => item.id === arcId)
  if (!arc || arc.type !== 'arc') return null
  const angles = getArcAngles(document, arc)
  const setArc = (patch: Partial<GeometryArc>): void =>
    commit(setArcProperties(document, arc.id, patch))
  return (
    <>
      <label>
        {t('geometryRadius')}{' '}
        <input
          aria-label={t('geometryRadius')}
          type="number"
          value={Math.round(arc.radius * 100) / 100}
          onChange={(event) => setArc({ radius: Math.max(1, Number(event.target.value) || 1) })}
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

function ConstraintsList({ document, commit }: Props): React.JSX.Element | null {
  const { t } = useI18n()
  if (!document.constraints.length) return null
  const label = (type: string): string => t(CONSTRAINT_LABEL_KEYS[type] ?? ('' as TranslationKey)) || type
  return (
    <aside className="geometry-constraints">
      <strong>{t('geometryConstraints')}</strong>
      {document.constraints.map((constraint, index) => {
        const result = evaluateConstraints(document, [constraint])[0]
        return (
          <div key={`${constraint.type}-${index}`} className={result.valid ? 'constraint-valid' : 'constraint-invalid'}>
            <span>
              {label(constraint.type)}: {result.valid ? t('geometrySatisfied') : result.message ?? t('geometryUnsatisfied')}
            </span>
            {constraint.type === 'fixedAngle' ? (
              <input
                aria-label={`${t('geometryAngle')}-${index}`}
                type="number"
                style={{ width: 64 }}
                value={Math.round((constraint.value * 180) / Math.PI)}
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

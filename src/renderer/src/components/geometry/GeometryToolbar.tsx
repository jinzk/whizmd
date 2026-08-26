import { useEffect, useRef, useState } from 'react'
import { type GeometryToolId } from '../../geometry'
import { useI18n, type TranslationKey } from '../../i18n'
import type { ShapeKind } from '../../geometry/core/shapeFactory'
import { SHAPE_DESCRIPTORS } from '../../geometry/core/shapeDescriptors'

const SHAPE_LABELS: Record<ShapeKind, TranslationKey> = {
  circle: 'geometryCircle',
  ellipse: 'geometryShapeEllipse',
  square: 'geometryShapeSquare',
  rectangle: 'geometryShapeRectangle',
  parallelogram: 'geometryShapeParallelogram',
  rhombus: 'geometryShapeRhombus',
  equilateral: 'geometryShapeEquilateral',
  isosceles: 'geometryShapeIsosceles'
}

type ToolEntry = { id: GeometryToolId; label: TranslationKey }

const DRAW_TOOLS: ToolEntry[] = [
  { id: 'point', label: 'geometryPoint' },
  { id: 'segment', label: 'geometrySegment' },
  { id: 'polygon', label: 'geometryPolygon' },
  { id: 'arc', label: 'geometryArc' },
  { id: 'text', label: 'geometryText' }
]

const CONSTRUCT_TOOLS: ToolEntry[] = [
  { id: 'midpoint', label: 'geometryMidpoint' },
  { id: 'intersection', label: 'geometryIntersection' },
  { id: 'perpendicularFoot', label: 'geometryFoot' },
  { id: 'coincident', label: 'geometryCoincident' },
  { id: 'splitSegment', label: 'geometrySplitSegment' }
]

const CONSTRAINT_TOOLS: ToolEntry[] = [
  { id: 'parallel', label: 'geometryParallel' },
  { id: 'perpendicular', label: 'geometryPerpendicular' },
  { id: 'equalLength', label: 'geometryEqualLength' },
  { id: 'horizontal', label: 'geometryHorizontal' },
  { id: 'vertical', label: 'geometryVerticalEdge' },
  { id: 'tangent', label: 'geometryTangent' },
  { id: 'symmetric', label: 'geometrySymmetric' },
  { id: 'angle', label: 'geometryAngle' }
]

const TRANSFORM_TOOLS: ToolEntry[] = [
  { id: 'move', label: 'geometryMove' },
  { id: 'rotate', label: 'geometryRotate' },
  { id: 'splitAtIntersection', label: 'geometrySplitIntersection' }
]

const COMING_SOON: TranslationKey[] = [
  'geometryMeasure',
  'geometryMirror',
  'geometryOffset',
  'geometryTrim'
]

type Props = {
  tool: GeometryToolId
  canUndo: boolean
  canRedo: boolean
  onTool: (tool: GeometryToolId) => void
  onShapeKind: (kind: ShapeKind) => void
  onUndo: () => void
  onRedo: () => void
}

export function GeometryToolbar({ tool, canUndo, canRedo, onTool, onShapeKind, onUndo, onRedo }: Props): React.JSX.Element {
  const { t } = useI18n()
  const [shapePickerOpen, setShapePickerOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<'construct' | 'constraint' | 'transform' | 'more' | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!shapePickerOpen) return
    const close = (event: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setShapePickerOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [shapePickerOpen])

  useEffect(() => {
    if (!openMenu) return
    const close = (event: MouseEvent): void => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openMenu])

  const toolButton = (id: GeometryToolId, labelKey: TranslationKey, closeMenu = false): React.JSX.Element => (
    <button key={id} type="button" className={tool === id ? 'active' : ''} title={t(labelKey)} onClick={() => { onTool(id); if (closeMenu) setOpenMenu(null) }}>
      {t(labelKey)}
    </button>
  )

  const drawGroup = (labelKey: TranslationKey, entries: ToolEntry[]): React.JSX.Element => (
    <span className="geometry-toolbar-group">
      <span className="geometry-toolbar-group-label">{t(labelKey)}</span>
      {entries.map(({ id, label }) => toolButton(id, label))}
    </span>
  )

  const category = (id: 'construct' | 'constraint' | 'transform', labelKey: TranslationKey, entries: ToolEntry[]): React.JSX.Element => {
    const active = entries.some((entry) => entry.id === tool)
    const expanded = openMenu === id
    return (
      <span className="geometry-category-wrap">
        <button
          type="button"
          className={active ? 'active' : ''}
          aria-haspopup="menu"
          aria-expanded={expanded}
          title={t(labelKey)}
          onClick={() => setOpenMenu(expanded ? null : id)}
        >
          {t(labelKey)} ▾
        </button>
        {expanded ? (
          <span className="geometry-category-popover" role="menu" aria-label={t(labelKey)}>
            {entries.map(({ id: toolId, label }) => toolButton(toolId, label, true))}
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <div className="geometry-toolbar" ref={toolbarRef}>
      {drawGroup('geometryGroupDraw', DRAW_TOOLS)}
      <span className="geometry-shape-wrap" ref={pickerRef}>
        <button
          type="button"
          className={tool === 'shape' ? 'active' : ''}
          aria-haspopup="listbox"
          aria-expanded={shapePickerOpen}
          title={t('geometryShapeHint')}
          onClick={() => {
            onTool('shape')
            setShapePickerOpen((open) => !open)
          }}
        >
          {t('geometryShape')}
        </button>
        {shapePickerOpen ? (
          <span className="geometry-shape-popover" role="listbox" aria-label={t('geometryShape')}>
            {SHAPE_DESCRIPTORS.map(({ kind }) => (
              <button
                key={kind}
                type="button"
                role="option"
                onClick={() => {
                  onShapeKind(kind)
                  onTool('shape')
                  setShapePickerOpen(false)
                }}
              >
                {t(SHAPE_LABELS[kind])}
              </button>
            ))}
          </span>
        ) : null}
      </span>

      {category('construct', 'geometryGroupConstruct', CONSTRUCT_TOOLS)}
      {category('constraint', 'geometryGroupConstraint', CONSTRAINT_TOOLS)}
      {category('transform', 'geometryGroupTransform', TRANSFORM_TOOLS)}

      <span className="geometry-toolbar-spacer" />

      <span className="geometry-category-wrap">
        <button
          type="button"
          className={openMenu === 'more' ? 'active' : ''}
          aria-haspopup="true"
          aria-expanded={openMenu === 'more'}
          title={t('geometryToolbarMore')}
          onClick={() => setOpenMenu((open) => open === 'more' ? null : 'more')}
        >
          {t('geometryToolbarMore')} ▾
        </button>
        {openMenu === 'more' ? (
          <span className="geometry-category-popover geometry-more-popover" role="menu" aria-label={t('geometryToolbarMore')}>
            <span className="geometry-more-section">
              <span className="geometry-more-section-label">{t('geometryComingSoon')}</span>
              {COMING_SOON.map((label) => (
                <button key={label} type="button" className="geometry-toolbar-comingsoon" disabled title={t('geometryComingSoon')}>
                  {t(label)}
                </button>
              ))}
            </span>
          </span>
        ) : null}
      </span>

      <span className="geometry-toolbar-sep" />
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        {t('undo')}
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo}>
        {t('redo')}
      </button>
    </div>
  )
}

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
  const pickerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!shapePickerOpen) return
    const close = (event: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setShapePickerOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [shapePickerOpen])

  const toolButton = (id: GeometryToolId, labelKey: TranslationKey): React.JSX.Element => (
    <button key={id} type="button" className={tool === id ? 'active' : ''} title={t(labelKey)} onClick={() => onTool(id)}>
      {t(labelKey)}
    </button>
  )
  return (
    <div className="geometry-toolbar">
      {toolButton('point', 'geometryPoint')}
      {toolButton('segment', 'geometrySegment')}
      {toolButton('polygon', 'geometryPolygon')}
      {toolButton('arc', 'geometryArc')}
      {toolButton('text', 'geometryText')}
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
      <span className="geometry-toolbar-sep" />
      {toolButton('move', 'geometryMove')}
      {toolButton('rotate', 'geometryRotate')}
      <span className="geometry-toolbar-sep" />
      {toolButton('midpoint', 'geometryMidpoint')}
      {toolButton('intersection', 'geometryIntersection')}
      {toolButton('perpendicularFoot', 'geometryFoot')}
      <span className="geometry-toolbar-sep" />
      {toolButton('coincident', 'geometryCoincident')}
      {toolButton('parallel', 'geometryParallel')}
      {toolButton('perpendicular', 'geometryPerpendicular')}
      {toolButton('equalLength', 'geometryEqualLength')}
      {toolButton('tangent', 'geometryTangent')}
      {toolButton('symmetric', 'geometrySymmetric')}
      {toolButton('angle', 'geometryAngle')}
      {toolButton('horizontal', 'geometryHorizontal')}
      {toolButton('vertical', 'geometryVerticalEdge')}
      {toolButton('splitSegment', 'geometrySplitSegment')}
      <span className="geometry-toolbar-sep" />
      {toolButton('splitAtIntersection', 'geometrySplitIntersection')}
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        {t('undo')}
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo}>
        {t('redo')}
      </button>
    </div>
  )
}

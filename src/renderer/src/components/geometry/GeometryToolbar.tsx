import { useEffect, useRef, useState } from 'react'
import { type GeometryToolId } from '../../geometry'
import { useI18n, type TranslationKey } from '../../i18n'

type ToolEntry = { id: GeometryToolId; label: TranslationKey }

function CursorIcon(): React.JSX.Element {
  return <svg className="geometry-tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l13 9-6 1 3 6-3 1-3-6-4 4V3z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
}

function HandIcon(): React.JSX.Element {
  return <svg className="geometry-tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12V6a1.5 1.5 0 0 1 3 0v5V5a1.5 1.5 0 0 1 3 0v6V6a1.5 1.5 0 0 1 3 0v7l1-1a1.7 1.7 0 0 1 2.4 2.4l-3.2 4A4 4 0 0 1 14 20h-2.5A4.5 4.5 0 0 1 7 15.5V12a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

const CONSTRUCT_TOOLS: ToolEntry[] = [
  { id: 'midpoint', label: 'geometryMidpoint' },
  { id: 'intersection', label: 'geometryIntersection' },
  { id: 'coincident', label: 'geometryCoincident' },
  { id: 'splitNode', label: 'geometrySplitNode' },
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

type Props = {
  tool: GeometryToolId
  canUndo: boolean
  canRedo: boolean
  onTool: (tool: GeometryToolId) => void
  onUndo: () => void
  onRedo: () => void
}

export function GeometryToolbar({ tool, canUndo, canRedo, onTool, onUndo, onRedo }: Props): React.JSX.Element {
  const { t } = useI18n()
  const [openMenu, setOpenMenu] = useState<'construct' | 'constraint' | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

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

  const modeButton = (id: 'select' | 'move', labelKey: TranslationKey, icon: React.ReactNode): React.JSX.Element => (
    <button key={id} type="button" className={`geometry-mode-button${tool === id ? ' active' : ''}`} aria-label={t(labelKey)} title={t(labelKey)} onClick={() => onTool(id)}>{icon}</button>
  )

  const category = (id: 'construct' | 'constraint', labelKey: TranslationKey, entries: ToolEntry[]): React.JSX.Element => {
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
      <span className="geometry-toolbar-modes">
        {modeButton('select', 'geometrySelect', <CursorIcon />)}
        {modeButton('move', 'geometryMove', <HandIcon />)}
        <span className="geometry-toolbar-sep" />
        <button type="button" onClick={onUndo} disabled={!canUndo} aria-label={t('undo')} title={t('undo')}>{t('undo')}</button>
        <button type="button" onClick={onRedo} disabled={!canRedo} aria-label={t('redo')} title={t('redo')}>{t('redo')}</button>
      </span>
      {category('construct', 'geometryGroupConstruct', CONSTRUCT_TOOLS)}
      {category('constraint', 'geometryGroupConstraint', CONSTRAINT_TOOLS)}

      <span className="geometry-toolbar-spacer" />
    </div>
  )
}

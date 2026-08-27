import { type GeometryToolId } from '../../geometry'
import type { ShapeKind } from '../../geometry/core/shapeFactory'
import { SHAPE_DESCRIPTORS } from '../../geometry/core/shapeDescriptors'
import { useI18n, type TranslationKey } from '../../i18n'

type Props = { tool: GeometryToolId; shapeKind: ShapeKind; onTool: (tool: GeometryToolId) => void; onShapeKind: (kind: ShapeKind) => void }
type DrawingEntry = { id: GeometryToolId; label: TranslationKey; icon: React.JSX.Element }

const Icon = ({ children }: { children: React.ReactNode }): React.JSX.Element => <svg className="geometry-drawing-tool-icon" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
const icons = {
  point: <Icon><circle cx="12" cy="12" r="3" fill="currentColor" /></Icon>,
  segment: <Icon><path d="M5 19L19 5M5 19h5M19 5v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></Icon>,
  polygon: <Icon><path d="M5 17L8 6l10 1 2 10-8 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></Icon>,
  arc: <Icon><path d="M5 17a8 8 0 0 1 14-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="5" cy="17" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></Icon>,
  text: <Icon><path d="M5 6h14M12 6v13M8 19h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></Icon>,
}

const shapeIcons: Record<ShapeKind, React.JSX.Element> = {
  circle: <Icon><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" /></Icon>,
  ellipse: <Icon><ellipse cx="12" cy="12" rx="8" ry="5" fill="none" stroke="currentColor" strokeWidth="1.8" /></Icon>,
  square: <Icon><rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" /></Icon>,
  rectangle: <Icon><rect x="4" y="7" width="16" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" /></Icon>,
  parallelogram: <Icon><path d="M8 5h12l-4 14H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></Icon>,
  rhombus: <Icon><path d="M12 4l8 8-8 8-8-8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></Icon>,
  equilateral: <Icon><path d="M12 4l8 15H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></Icon>,
  isosceles: <Icon><path d="M12 4l6 15H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></Icon>,
  rightTriangle: <Icon><path d="M5 19V5h14z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M5 16h3v3" fill="none" stroke="currentColor" strokeWidth="1.4" /></Icon>
}

const DRAWING_TOOLS: DrawingEntry[] = [
  { id: 'point', label: 'geometryPoint', icon: icons.point },
  { id: 'segment', label: 'geometrySegment', icon: icons.segment },
  { id: 'polygon', label: 'geometryPolygon', icon: icons.polygon },
  { id: 'arc', label: 'geometryArc', icon: icons.arc },
  { id: 'text', label: 'geometryText', icon: icons.text },
]

const SHAPE_LABELS: Record<ShapeKind, TranslationKey> = {
  circle: 'geometryCircle', ellipse: 'geometryShapeEllipse', square: 'geometryShapeSquare', rectangle: 'geometryShapeRectangle',
  parallelogram: 'geometryShapeParallelogram', rhombus: 'geometryShapeRhombus', equilateral: 'geometryShapeEquilateral', isosceles: 'geometryShapeIsosceles', rightTriangle: 'geometryShapeRightTriangle'
}

export function GeometryDrawingToolsPanel({ tool, shapeKind, onTool, onShapeKind }: Props): React.JSX.Element {
  const { t } = useI18n()
  return <aside className="geometry-drawing-tools" aria-label={t('geometryGroupDraw')}>
    <div className="geometry-drawing-tools-list">
      {DRAWING_TOOLS.map((entry) => <button key={entry.id} type="button" className={tool === entry.id ? 'active' : ''} aria-label={t(entry.label)} title={t(entry.label)} onClick={() => onTool(entry.id)}>{entry.icon}<span>{t(entry.label)}</span></button>)}
      <div className="geometry-drawing-shapes" role="list" aria-label={t('geometryShape')}>
        {SHAPE_DESCRIPTORS.map(({ kind }) => <button key={kind} type="button" role="option" className={tool === 'shape' && shapeKind === kind ? 'active' : ''} aria-label={t(SHAPE_LABELS[kind])} title={t(SHAPE_LABELS[kind])} onClick={() => { onShapeKind(kind); onTool('shape') }}>{shapeIcons[kind]}<span>{t(SHAPE_LABELS[kind])}</span></button>)}
      </div>
    </div>
  </aside>
}

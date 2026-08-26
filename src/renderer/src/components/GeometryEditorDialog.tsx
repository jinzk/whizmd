import { useRef, useState } from 'react'
import { Dialog } from './Dialog'
import {
  GEOMETRY_TOOLS,
  acceptsTarget,
  addArc,
  addEllipse,
  addConstraint,
  addIntersection,
  addMidpoint,
  addPerpendicularFoot,
  addPoint,
  addSegment,
  addText,
  appendPolygonVertex,
  buildShape,
  canFinishPolygon,
  checkMergePoints,
  closePolygonSession,
  createCommandHistory,
  createDocumentCommand,
  createGeometryDocument,
  createPolygonDrawingSession,
  executeGeometryCommand,
  findConstrainedShapeCycle,
  findPolygonCycle,
  hitTest,
  isAxisResizableRectangle,
  isInteractiveCanvasTool,
  isSimpleCycle,
  materializeIntersection,
  mergePoints,
  movePoint,
  pickGeometryTarget,
  redoGeometryCommand,
  removeConstraint,
  removeObject,
  renderGeometrySvg,
  resizeCircle,
  resolvePoint,
  rotateAboutPivot,
  scaleAboutAnchor,
  solveGeometry,
  stretchAboutAnchor,
  undoGeometryCommand,
  type GeometryDocument,
  type GeometryToolId,
  type TargetKind
} from '../geometry'
import type { ShapeKind } from '../geometry/core/shapeFactory'
import { useI18n } from '../i18n'
import { ConstructionHintBar } from './geometry/ConstructionHintBar'
import { GeometryToolbar } from './geometry/GeometryToolbar'
import { GeometryPreviewLayers, findPoint } from './geometry/GeometryPreviewLayers'
import { GeometryObjects } from './geometry/GeometryObjects'
import { GeometryConstraintMarkers } from './geometry/GeometryConstraintMarkers'
import { GeometrySidePanel } from './geometry/GeometrySidePanel'
import { useGeometryDrag } from '../hooks/useGeometryDrag'

type Props = { onClose: () => void; onSave: (svg: string) => void | Promise<void>; initialDocument?: GeometryDocument; existingPath?: string }

export function GeometryEditorDialog({ onClose, onSave, initialDocument }: Props): React.JSX.Element {
  const { t } = useI18n()
  const { beginWindowDrag } = useGeometryDrag()
  const [document, setDocument] = useState<GeometryDocument>(initialDocument ?? createGeometryDocument)
  const documentRef = useRef<GeometryDocument>(document)
  const [tool, setTool] = useState<GeometryToolId>('point')
  const [shapeKind, setShapeKind] = useState<ShapeKind>('square')
  const [shapeAnchor, setShapeAnchor] = useState<{ x: number; y: number } | null>(null)
  const [shapeCursor, setShapeCursor] = useState<{ x: number; y: number } | null>(null)
  const [history, setHistory] = useState(createCommandHistory)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const dragCycleRef = useRef<string[] | null>(null)
  const dragStartDocument = useRef<GeometryDocument | null>(null)
  const firstPoint = useRef<string | null>(null)
  const [polygonSession, setPolygonSession] = useState(createPolygonDrawingSession)
  const [polygonCursor, setPolygonCursor] = useState<{ x: number; y: number } | null>(null)
  const [mergeNotice, setMergeNotice] = useState<string | null>(null)
  const [snapHint, setSnapHint] = useState<{ x: number; y: number } | null>(null)
  const selectedObjects = useRef<string[]>([])
  const [constructionSelectionCount, setConstructionSelectionCount] = useState(0)
  const canvasRef = useRef<SVGSVGElement>(null)
  const selectionDrag = useRef<{ x: number; y: number; additive: boolean } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const selectionBoxRef = useRef<typeof selectionBox>(null)
  const polygonBaseDocument = useRef<GeometryDocument | null>(null)
  const arcDraft = useRef<{ centerId: string; cx: number; cy: number; radius: number; startAngle: number; startAnchorId?: string; endAnchorId?: string } | null>(null)
  const [arcStage, setArcStage] = useState(0)
  const [arcDraftView, setArcDraftView] = useState<{ cx: number; cy: number; radius: number; startAngle: number } | null>(null)
  const [arcCursor, setArcCursor] = useState<{ x: number; y: number } | null>(null)
  const ellipseDraft = useRef<{ focusA: string; focusB?: string } | null>(null)
  const [ellipsePreview, setEllipsePreview] = useState<{ focusA: { x: number; y: number }; focusB: { x: number; y: number }; semiMajor: number } | null>(null)
  const ellipseBaseDocument = useRef<GeometryDocument | null>(null)
  const ellipseRadiusDragging = useRef(false)
  const ellipseClickConsumed = useRef(false)

  const toLocal = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = canvasRef.current
    if (!svg) return { x: clientX, y: clientY }
    if (typeof svg.createSVGPoint === 'function' && svg.getScreenCTM()) {
      const point = svg.createSVGPoint()
      point.x = clientX
      point.y = clientY
      const local = point.matrixTransform(svg.getScreenCTM()!.inverse())
      return { x: local.x, y: local.y }
    }
    const rect = svg.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const nextPointLabel = (doc: GeometryDocument): string => `P${doc.objects.filter((object) => object.type === 'point').length + 1}`
  const updateDocument = (next: GeometryDocument): void => {
    documentRef.current = next
    setDocument(next)
  }
  const previewDocument = (next: GeometryDocument): void => updateDocument(next)
  const commit = (next: GeometryDocument): void => {
    setHistory((current) => executeGeometryCommand(current, documentRef.current, createDocumentCommand('update', () => next)).history)
    updateDocument(next)
  }

  const discardPolygonDraft = (): void => {
    const base = polygonBaseDocument.current
    if (base && polygonSession.vertexIds.length) updateDocument(base)
    polygonBaseDocument.current = null
    setPolygonSession(createPolygonDrawingSession())
    setPolygonCursor(null)
  }
  const finalizePolygon = (): void => {
    if (!canFinishPolygon(polygonSession)) return
    const base = polygonBaseDocument.current ?? documentRef.current
    setHistory((current) => ({ past: [...current.past, base], future: [] }))
    updateDocument(closePolygonSession(documentRef.current, polygonSession))
    polygonBaseDocument.current = null
    setPolygonSession(createPolygonDrawingSession())
    setPolygonCursor(null)
  }
  const cancelPolygon = (): void => {
    if (tool !== 'polygon' || !polygonSession.vertexIds.length) return
    discardPolygonDraft()
  }

  const cancelArcDraft = (): void => {
    arcDraft.current = null
    setArcStage(0)
    setArcDraftView(null)
  }
  const advanceArc = (target: { id: string | null; x: number; y: number }): void => {
    if (!arcDraft.current) {
      if (target.id) {
        arcDraft.current = { centerId: target.id, cx: target.x, cy: target.y, radius: 0, startAngle: 0 }
      } else {
        const next = addPoint(document, target.x, target.y, nextPointLabel(document))
        commit(next)
        arcDraft.current = { centerId: next.objects.at(-1)!.id, cx: target.x, cy: target.y, radius: 0, startAngle: 0 }
      }
      setArcStage(1)
      setArcDraftView({ ...arcDraft.current })
      return
    }
    const draft = arcDraft.current
    if (arcStage === 1) {
      arcDraft.current = {
        ...draft,
        radius: Math.max(1, Math.hypot(target.x - draft.cx, target.y - draft.cy)),
        startAngle: Math.atan2(target.y - draft.cy, target.x - draft.cx),
        startAnchorId: target.id ?? undefined
      }
      setArcDraftView({ ...arcDraft.current })
      setArcStage(2)
      return
    }
    commit(addArc(document, draft.centerId, draft.radius, draft.startAngle, Math.atan2(target.y - draft.cy, target.x - draft.cx), { startAnchor: draft.startAnchorId, endAnchor: target.id ?? undefined }))
    cancelArcDraft()
  }
  const handleArcCanvasClick = (event: React.MouseEvent<SVGSVGElement>): void => {
    const local = toLocal(event.clientX, event.clientY)
    const snap = pickGeometryTarget(document, local)
    advanceArc(snap.type === 'point' || snap.type === 'endpoint' ? { id: snap.pointId, x: snap.point.x, y: snap.point.y } : { id: null, x: local.x, y: local.y })
  }

  const cancelShapeDraft = (): void => {
    setShapeAnchor(null)
    setShapeCursor(null)
  }
  const cancelEllipseDraft = (): void => {
    if (ellipseBaseDocument.current) updateDocument(ellipseBaseDocument.current)
    ellipseBaseDocument.current = null
    ellipseDraft.current = null
    setEllipsePreview(null)
    ellipseRadiusDragging.current = false
  }
  const handleEllipseClick = (event: React.MouseEvent<SVGSVGElement>): void => {
    const local = toLocal(event.clientX, event.clientY)
    const target = pickGeometryTarget(document, local)
    const point = target.type === 'point' || target.type === 'endpoint' ? { id: target.pointId, ...target.point } : null
    if (!ellipseDraft.current) {
      ellipseBaseDocument.current = documentRef.current
      const next = point ? document : addPoint(document, local.x, local.y, nextPointLabel(document))
      ellipseDraft.current = { focusA: point?.id ?? next.objects.at(-1)!.id }
      updateDocument(next)
      return
    }
    if (!ellipseDraft.current.focusB) {
      const next = point ? document : addPoint(document, local.x, local.y, nextPointLabel(document))
      ellipseDraft.current = { ...ellipseDraft.current, focusB: point?.id ?? next.objects.at(-1)!.id }
      updateDocument(next)
      return
    }
  }
  const startEllipseRadiusDrag = (event: React.MouseEvent): void => {
    if (!ellipseDraft.current?.focusB) return
    const base = documentRef.current
    const focusA = resolvePoint(base, ellipseDraft.current.focusA)
    const focusB = resolvePoint(base, ellipseDraft.current.focusB)
    const origin = toLocal(event.clientX, event.clientY)
    if (!focusA || !focusB || Math.hypot(origin.x - focusB.x, origin.y - focusB.y) > 14) return
    event.stopPropagation()
    ellipseRadiusDragging.current = true
    let cursor = toLocal(event.clientX, event.clientY)
    beginWindowDrag((nextEvent) => {
      cursor = toLocal(nextEvent.clientX, nextEvent.clientY)
      setEllipsePreview({ focusA, focusB, semiMajor: Math.max(Math.hypot(cursor.x - focusA.x, cursor.y - focusA.y) + Math.hypot(cursor.x - focusB.x, cursor.y - focusB.y), Math.hypot(focusB.x - focusA.x, focusB.y - focusA.y)) / 2 })
    }, () => {
      if (!ellipseRadiusDragging.current || !ellipseDraft.current?.focusB) return
      const semiMajor = Math.max(Math.hypot(cursor.x - focusA.x, cursor.y - focusA.y) + Math.hypot(cursor.x - focusB.x, cursor.y - focusB.y), Math.hypot(focusB.x - focusA.x, focusB.y - focusA.y)) / 2
      commit(addEllipse(documentRef.current, ellipseDraft.current.focusA, ellipseDraft.current.focusB, semiMajor))
      ellipseClickConsumed.current = true
      ellipseRadiusDragging.current = false
      ellipseBaseDocument.current = null
      ellipseDraft.current = null
      setEllipsePreview(null)
    })
  }
  // 形状工具只允许从空白区域起笔创建；落在已有图元附近时不吸附、不新建，
  // 交还给默认的框选行为。
  const beginShapeDraft = (event: React.MouseEvent<SVGSVGElement>): boolean => {
    const local = toLocal(event.clientX, event.clientY)
    if (pickGeometryTarget(document, local).type !== 'empty') return false
    setShapeAnchor({ x: local.x, y: local.y })
    setShapeCursor({ x: local.x, y: local.y })
    return true
  }
  const handleShapeMouseUp = (event: React.MouseEvent<SVGSVGElement>): void => {
    const anchor = shapeAnchor
    if (!anchor) return
    const end = toLocal(event.clientX, event.clientY)
    setShapeAnchor(null)
    setShapeCursor(null)
    if (Math.hypot(end.x - anchor.x, end.y - anchor.y) < 6) return
    commit(buildShape(document, shapeKind, anchor.x, anchor.y, end.x, end.y))
  }

  const startTranslate = (pointIds: string[], event: React.MouseEvent): void => {
    event.stopPropagation()
    const base = documentRef.current
    const origin = toLocal(event.clientX, event.clientY)
    const anchors = pointIds.map((id) => ({ id, point: resolvePoint(base, id) })).filter((item): item is { id: string; point: { x: number; y: number } } => Boolean(item.point))
    if (!anchors.length) return
    let moved = false
    beginWindowDrag((nextEvent) => {
      const current = toLocal(nextEvent.clientX, nextEvent.clientY)
      const deltaX = current.x - origin.x
      const deltaY = current.y - origin.y
      if (!deltaX && !deltaY) return
      moved = true
      let next = documentRef.current
      for (const anchor of anchors) next = movePoint(next, anchor.id, anchor.point.x + deltaX, anchor.point.y + deltaY)
      updateDocument(next)
    }, () => {
      if (moved) setHistory((items) => ({ past: [...items.past, base], future: [] }))
    })
  }

  const activateTool = (nextTool: GeometryToolId): void => {
    if (tool === 'polygon' && nextTool !== 'polygon' && polygonSession.vertexIds.length) discardPolygonDraft()
    if (tool === 'arc' && nextTool !== 'arc') cancelArcDraft()
    if (tool === 'shape' && nextTool !== 'shape' && ellipseDraft.current) cancelEllipseDraft()
    firstPoint.current = null
    selectedObjects.current = []
    setConstructionSelectionCount(0)
    setMergeNotice(null)
    setSnapHint(null)
    setTool(nextTool)
  }

  const continueSegment = (pointId: string): void => {
    if (firstPoint.current && firstPoint.current !== pointId) {
      commit(addSegment(document, firstPoint.current, pointId))
      firstPoint.current = null
    } else {
      firstPoint.current = pointId
    }
  }
  const continuePolygon = (pointId: string): void => {
    if (polygonSession.vertexIds.length >= 3 && pointId === polygonSession.vertexIds[0]) {
      finalizePolygon()
      return
    }
    if (!polygonSession.vertexIds.includes(pointId)) {
      const prev = polygonSession.vertexIds.at(-1)
      if (prev && prev !== pointId) {
        if (!polygonBaseDocument.current) polygonBaseDocument.current = documentRef.current
        previewDocument(addSegment(documentRef.current, prev, pointId))
      }
      setPolygonSession(appendPolygonVertex(polygonSession, pointId))
    }
  }

  const addAt = (event: React.MouseEvent<SVGSVGElement>): void => {
    if (GEOMETRY_TOOLS[tool].canvasClick !== 'draw') return
    if (!canvasRef.current) return
    const local = toLocal(event.clientX, event.clientY)
    if (tool === 'segment' || tool === 'polygon') {
      const snap = pickGeometryTarget(document, local)
      if (snap.type === 'endpoint' || snap.type === 'point') {
        if (tool === 'segment') continueSegment(snap.pointId)
        else continuePolygon(snap.pointId)
        return
      }
    }
    const x = Math.max(0, Math.min(document.width, local.x))
    const y = Math.max(0, Math.min(document.height, local.y))
    if (tool === 'text') {
      const text = window.prompt(t('geometryTextPrompt'), 'A')
      if (text) commit(addText(document, x, y, text))
      return
    }
    const next = addPoint(document, x, y, nextPointLabel(document))
    if (tool === 'polygon') {
      const firstVertexId = polygonSession.vertexIds[0]
      const firstVertex = document.objects.find((object) => object.type === 'point' && object.id === firstVertexId)
      if (polygonSession.vertexIds.length >= 3 && firstVertex && firstVertex.type === 'point' && Math.hypot(x - firstVertex.x, y - firstVertex.y) <= 12) {
        finalizePolygon()
        return
      }
      if (!polygonBaseDocument.current) polygonBaseDocument.current = documentRef.current
      const pointId = next.objects.at(-1)!.id
      const prev = polygonSession.vertexIds.at(-1)
      previewDocument(prev ? addSegment(next, prev, pointId) : next)
      setPolygonSession(appendPolygonVertex(polygonSession, pointId))
      return
    }
    if (tool === 'segment' && firstPoint.current) {
      commit(addSegment(next, firstPoint.current, next.objects.at(-1)!.id))
      firstPoint.current = null
    } else {
      commit(next)
      setSelectedId(next.objects.at(-1)!.id)
      setSelectedIds([next.objects.at(-1)!.id])
      if (tool === 'segment') firstPoint.current = next.objects.at(-1)!.id
    }
  }

  const finishPolygon = (): void => {
    if (tool !== 'polygon') return
    finalizePolygon()
  }

  const undo = (): void => {
    const result = undoGeometryCommand(history, document)
    if (!result) return
    setHistory(result.history)
    updateDocument(result.document)
  }
  const redo = (): void => {
    const result = redoGeometryCommand(history, document)
    if (!result) return
    setHistory(result.history)
    updateDocument(result.document)
  }

  const resizeSelectedCircle = (event: React.KeyboardEvent<SVGSVGElement>): void => {
    if (!selectedId || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
    const circle = document.objects.find((object) => object.id === selectedId)
    if (!circle || circle.type !== 'circle') return
    event.preventDefault()
    const delta = event.key === 'ArrowUp' ? 5 : -5
    commit(resizeCircle(document, selectedId, circle.radius + delta))
  }

  const selectObject = (id: string, event: React.MouseEvent): void => {
    if (['segment', 'polygon', 'text'].includes(tool)) return
    event.stopPropagation()
    setSelectedId(id)
    setSelectedIds((current) => (event.shiftKey ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id]))
  }

  const startSelectionBox = (event: React.MouseEvent<SVGSVGElement>): void => {
    if (event.target !== event.currentTarget) return
    const point = toLocal(event.clientX, event.clientY)
    selectionDrag.current = { x: point.x, y: point.y, additive: event.shiftKey }
    beginWindowDrag((nextEvent) => {
      if (!selectionDrag.current) return
      const current = toLocal(nextEvent.clientX, nextEvent.clientY)
      const box = {
        x: Math.min(selectionDrag.current.x, current.x),
        y: Math.min(selectionDrag.current.y, current.y),
        width: Math.abs(current.x - selectionDrag.current.x),
        height: Math.abs(current.y - selectionDrag.current.y)
      }
      selectionBoxRef.current = box
      setSelectionBox(box)
    }, () => {
      if (selectionDrag.current && selectionBoxRef.current) {
        const box = selectionBoxRef.current
        const selected = document.objects
          .filter((object) => {
            const point = object.type === 'point' ? { x: object.x, y: object.y } : object.type === 'text' ? { x: object.x, y: object.y } : null
            return point && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
          })
          .map((object) => object.id)
        const ids = selectionDrag.current.additive ? [...new Set([...selectedIds, ...selected])] : selected
        setSelectedIds(ids)
        setSelectedId(ids[0] ?? null)
      }
      selectionDrag.current = null
      selectionBoxRef.current = null
      setSelectionBox(null)
    })
  }

  const advanceConstructionSelection = (id: string): void => {
    const profile = GEOMETRY_TOOLS[tool]
    if (selectedObjects.current.includes(id)) return
    selectedObjects.current = [...selectedObjects.current, id]
    const selected = selectedObjects.current
    setConstructionSelectionCount(selected.length)
    setSelectedIds(selected)
    setSelectedId(id)
    if (selected.length < profile.selects.length) return
    if (tool === 'coincident') {
      const rejection = checkMergePoints(document, selected[0], selected[1])
      if (rejection) {
        setMergeNotice(t(rejection === 'sameSegment' ? 'geometryMergeSameSegment' : 'geometryMergeDigon'))
        resetConstructionSelection()
        return
      }
    }
    const solved = profile.solveOnCreate ? solveGeometry(buildFromSelection(tool, selected)).document : buildFromSelection(tool, selected)
    commit(solved)
    resetConstructionSelection()
  }
  const resetConstructionSelection = (): void => {
    selectedObjects.current = []
    setConstructionSelectionCount(0)
    setSelectedIds([])
  }

  const selectForConstruction = (id: string, event: React.MouseEvent): void => {
    const profile = GEOMETRY_TOOLS[tool]
    if (profile.canvasClick === 'draw') {
      const objectType = document.objects.find((object) => object.id === id)?.type
      if (tool === 'point' && objectType === 'point') {
        event.stopPropagation()
        selectObject(id, event)
        return
      }
      if (tool === 'segment' && objectType === 'point') {
        event.stopPropagation()
        continueSegment(id)
        return
      }
      if (tool === 'polygon' && objectType === 'point') {
        event.stopPropagation()
        continuePolygon(id)
        return
      }
      if (objectType && objectType !== 'point') {
        // 点/文字工具下点击边、圆等已有图元 = 选中查看属性，而不是穿透创建。
        selectObject(id, event)
        return
      }
      return
    }
    event.stopPropagation()
    if (profile.canvasClick === 'arcDraft') {
      const point = document.objects.find((object) => object.type === 'point' && object.id === id)
      if (point && point.type === 'point') advanceArc({ id: point.id, x: point.x, y: point.y })
      return
    }
    setMergeNotice(null)
    const targetKind = document.objects.find((object) => object.id === id)?.type as TargetKind | undefined
    if (!targetKind || !acceptsTarget(profile, selectedObjects.current.length, targetKind)) return
    advanceConstructionSelection(id)
  }

  const buildFromSelection = (id: GeometryToolId, selection: string[]): GeometryDocument => {
    const base = documentRef.current
    switch (id) {
      case 'midpoint':
        return addMidpoint(base, selection[0], selection[1])
      case 'intersection':
        return addIntersection(base, selection[0], selection[1])
      case 'perpendicularFoot':
        return addPerpendicularFoot(base, selection[0], selection[1])
      case 'coincident':
        return mergePoints(base, selection[0], selection[1])
      case 'parallel':
        return addConstraint(base, { type: 'parallel', lineA: selection[0], lineB: selection[1] })
      case 'perpendicular':
        return addConstraint(base, { type: 'perpendicular', lineA: selection[0], lineB: selection[1] })
      case 'equalLength':
        return addConstraint(base, { type: 'equalLength', segmentA: selection[0], segmentB: selection[1] })
      case 'tangent':
        return addConstraint(base, { type: 'tangent', curveA: selection[0], curveB: selection[1] })
      case 'symmetric':
        return addConstraint(base, { type: 'symmetric', a: selection[0], b: selection[1], mirror: selection[2] })
      case 'angle': {
        const vertex = base.objects.find((object) => object.type === 'point' && object.id === selection[1])
        const armA = base.objects.find((object) => object.type === 'point' && object.id === selection[0])
        const armB = base.objects.find((object) => object.type === 'point' && object.id === selection[2])
        if (!vertex || vertex.type !== 'point' || !armA || armA.type !== 'point' || !armB || armB.type !== 'point') return base
        const current = Math.atan2(armB.y - vertex.y, armB.x - vertex.x) - Math.atan2(armA.y - vertex.y, armA.x - vertex.x)
        return addConstraint(base, { type: 'fixedAngle', a: selection[0], vertex: selection[1], b: selection[2], value: Math.atan2(Math.sin(current), Math.cos(current)) })
      }
      default:
        return base
    }
  }

  const handleConstructionCanvasClick = (event: React.MouseEvent<SVGSVGElement>): void => {
    if (tool === 'splitAtIntersection') return
    if (tool === 'horizontal' || tool === 'vertical') {
      const target = pickGeometryTarget(document, toLocal(event.clientX, event.clientY))
      if (target.type !== 'curve' || !document.objects.some((object) => object.type === 'segment' && object.id === target.curveId)) return
      commit(solveGeometry(addConstraint(document, { type: tool, segment: target.curveId })).document)
      return
    }
    if (tool === 'splitSegment') {
      const target = pickGeometryTarget(document, toLocal(event.clientX, event.clientY))
      if (target.type !== 'curve' || !document.objects.some((object) => object.type === 'segment' && object.id === target.curveId)) return
      const pointDocument = addPoint(document, target.point.x, target.point.y, nextPointLabel(document))
      commit(addConstraint(pointDocument, { type: 'pointOnLine', point: pointDocument.objects.at(-1)!.id, line: target.curveId, t: target.parameter }))
      return
    }
    if (!isInteractiveCanvasTool(tool)) return
    const local = toLocal(event.clientX, event.clientY)
    // Use a forgiving hit area because the rendered segment is intentionally thin.
    const hits = hitTest(document, local, 24)
    const profile = GEOMETRY_TOOLS[tool]
    const hit = hits.find((candidate) => {
      const object = document.objects.find((item) => item.id === candidate.id)
      if (!object) return false
      return acceptsTarget(profile, selectedObjects.current.length, object.type as TargetKind)
    })
    if (!hit) return
    selectForConstruction(hit.id, event)
  }

  // 受约束闭合图形（形状工具产物）的顶点拖拽：
  // · 矩形 → 对角点固定，宽高分别跟随光标的自由拉伸；
  // · 其余形状 → 以最远顶点为锚点整体等比缩放。
  // 两种均为仿射/相似变换，天然满足各自约束，无需求解器参与。
  const startShapeScaleDrag = (cycle: string[], id: string): void => {
    const base = documentRef.current
    const dragged = resolvePoint(base, id)
    const anchorId = cycle.reduce((best, current) => {
      const bestPoint = resolvePoint(base, best)
      const currentPoint = resolvePoint(base, current)
      const draggedPoint = resolvePoint(base, id)
      if (!bestPoint || !currentPoint || !draggedPoint) return best
      return Math.hypot(currentPoint.x - draggedPoint.x, currentPoint.y - draggedPoint.y) > Math.hypot(bestPoint.x - draggedPoint.x, bestPoint.y - draggedPoint.y) ? current : best
    }, cycle[0])
    const anchor = resolvePoint(base, anchorId)
    if (!dragged || !anchor) return
    const rectangleMode = isAxisResizableRectangle(base, cycle)
    const originLength = Math.hypot(dragged.x - anchor.x, dragged.y - anchor.y)
    const clampFactor = (value: number): number => (Number.isFinite(value) ? Math.sign(value || 1) * Math.max(0.02, Math.abs(value)) : 1)
    let moved = false
    beginWindowDrag((nextEvent) => {
      let next: GeometryDocument
      if (rectangleMode) {
        const local = toLocal(nextEvent.clientX, nextEvent.clientY)
        const factorX = clampFactor(dragged.x === anchor.x ? 1 : (local.x - anchor.x) / (dragged.x - anchor.x))
        const factorY = clampFactor(dragged.y === anchor.y ? 1 : (local.y - anchor.y) / (dragged.y - anchor.y))
        next = stretchAboutAnchor(base, cycle, anchor, factorX, factorY)
      } else {
        const local = toLocal(nextEvent.clientX, nextEvent.clientY)
        const factor = Math.max(0.02, Math.hypot(local.x - anchor.x, local.y - anchor.y) / originLength)
        next = scaleAboutAnchor(base, cycle, anchor, factor)
      }
      if (next === base) return
      moved = true
      updateDocument(next)
    }, () => {
      if (moved && documentRef.current !== base) {
        setHistory((items) => ({ past: [...items.past, base], future: [] }))
      }
    })
  }

  // 受约束闭合图形的顶点拖拽 = 以最远顶点为锚点整体等比缩放；
  // 「旋转」工具下的拖拽 = 绕图形质心刚体旋转。两者均为相似/刚体变换，
  // 天然满足形状全部约束，无需求解器参与。
  const startShapeRotateDrag = (cycle: string[], event: React.MouseEvent): void => {
    const base = documentRef.current
    const vertices = cycle.map((vertexId) => ({ vertexId, point: resolvePoint(base, vertexId) })).filter((item): item is { vertexId: string; point: { x: number; y: number } } => Boolean(item.point))
    if (vertices.length < cycle.length) return
    const pivot = {
      x: vertices.reduce((sum, item) => sum + item.point.x, 0) / vertices.length,
      y: vertices.reduce((sum, item) => sum + item.point.y, 0) / vertices.length
    }
    const start = toLocal(event.clientX, event.clientY)
    const radius = Math.hypot(start.x - pivot.x, start.y - pivot.y)
    if (!radius) return
    const startAngle = Math.atan2(start.y - pivot.y, start.x - pivot.x)
    let moved = false
    beginWindowDrag((nextEvent) => {
      const local = toLocal(nextEvent.clientX, nextEvent.clientY)
      const angle = Math.atan2(local.y - pivot.y, local.x - pivot.x) - startAngle
      moved = true
      updateDocument(rotateAboutPivot(base, cycle, pivot, angle))
    }, () => {
      if (moved && documentRef.current !== base) {
        setHistory((items) => ({ past: [...items.past, base], future: [] }))
      }
    })
  }

  const grabRigid = (pointIds: string[], event: React.MouseEvent): void => {
    if (tool === 'move') {
      // 拖动受约束闭合图形的边 = 整体平移该图形，避免拉成平行四边形。
      const shapeCycle = pointIds
        .map((pointId) => findConstrainedShapeCycle(documentRef.current, pointId))
        .find((cycle) => cycle !== null)
      startTranslate(shapeCycle ?? pointIds, event)
      return
    }
    if (tool === 'rotate') {
      // 依次尝试两端点探测形状环，避免其中一端与外部图元共享导致漏判。
      const cycle = pointIds
        .map((pointId) => findConstrainedShapeCycle(documentRef.current, pointId))
        .find((cycle) => cycle !== null)
      if (cycle) startShapeRotateDrag(cycle, event)
    }
  }

  const onSegmentEndpointPress = (segmentId: string, endpoint: 'start' | 'end', event: React.MouseEvent): void => {
    const segment = document.objects.find((object) => object.type === 'segment' && object.id === segmentId)
    if (!segment || segment.type !== 'segment') return
    const pointId = endpoint === 'start' ? segment.start : segment.end
    if (tool === 'rotate') {
      const cycle = findConstrainedShapeCycle(documentRef.current, pointId)
      if (cycle) {
        startShapeRotateDrag(cycle, event)
        return
      }
    }
    startSegmentEndpointDrag(segmentId, endpoint, event)
  }

  const startDrag = (id: string, event: React.MouseEvent): void => {
    const point = document.objects.find((object) => object.type === 'point' && object.id === id)
    if (!point || point.type !== 'point' || !canvasRef.current) return
    const shapeCycle = findConstrainedShapeCycle(documentRef.current, id)
    if (shapeCycle) {
      startShapeScaleDrag(shapeCycle, id)
      return
    }
    const local = toLocal(event.clientX, event.clientY)
    dragRef.current = { id, offsetX: local.x - point.x, offsetY: local.y - point.y }
    dragCycleRef.current = findPolygonCycle(documentRef.current, id)
    dragStartDocument.current = document
    beginWindowDrag((nextEvent) => {
      if (!dragRef.current || !canvasRef.current) return
      const nextLocal = toLocal(nextEvent.clientX, nextEvent.clientY)
      const moved = movePoint(documentRef.current, id, nextLocal.x - dragRef.current.offsetX, nextLocal.y - dragRef.current.offsetY)
      const solvedDocument = solveGeometry(moved, moved.constraints, 12, id).document
      if (dragCycleRef.current && !isSimpleCycle(solvedDocument, dragCycleRef.current)) return
      updateDocument(solvedDocument)
    }, () => {
      const solved = solveGeometry(documentRef.current, documentRef.current.constraints, 12, dragRef.current?.id)
      if (solved.status === 'solved') updateDocument(solved.document)
      else if (dragStartDocument.current) {
        updateDocument(dragStartDocument.current)
        setMergeNotice(t('geometrySolveRollback'))
      }
      if (dragStartDocument.current && documentRef.current !== dragStartDocument.current) {
        const base = dragStartDocument.current
        setHistory((items) => ({ past: [...items.past, base], future: [] }))
      }
      dragStartDocument.current = null
      dragRef.current = null
      dragCycleRef.current = null
    })
  }

  const onPointMouseDown = (id: string, event: React.MouseEvent<SVGCircleElement>): void => {
    if (tool === 'move') {
      startTranslate([id], event)
      return
    }
    if (tool === 'rotate') {
      const cycle = findConstrainedShapeCycle(documentRef.current, id)
      if (cycle) {
        startShapeRotateDrag(cycle, event)
        return
      }
    }
    if (tool === 'shape' && shapeKind === 'ellipse' && ellipseDraft.current?.focusB === id) {
      startEllipseRadiusDrag(event)
      return
    }
    selectObject(id, event)
    startDrag(id, event)
  }

  const startSegmentEndpointDrag = (segmentId: string, endpoint: 'start' | 'end', event: React.MouseEvent): void => {
    const segment = document.objects.find((object) => object.type === 'segment' && object.id === segmentId)
    if (!segment || segment.type !== 'segment') return
    startDrag(endpoint === 'start' ? segment.start : segment.end, event)
  }

  const startCircleResize = (id: string, event: React.MouseEvent): void => {
    event.stopPropagation()
    const circle = document.objects.find((object) => object.type === 'circle' && object.id === id)
    if (!circle || circle.type !== 'circle') return
    const center = resolvePoint(document, circle.center)
    if (!center) return
    const startDocument = document
    beginWindowDrag((nextEvent) => {
      const local = toLocal(nextEvent.clientX, nextEvent.clientY)
      const radius = Math.max(1, Math.hypot(local.x - center.x, local.y - center.y))
      updateDocument(resizeCircle(documentRef.current, id, radius))
    }, () => {
      setHistory((items) => ({ past: [...items.past, startDocument], future: [] }))
    })
  }

  const startArcHandleDrag = (id: string, kind: 'start' | 'end' | 'radius', event: React.MouseEvent): void => {
    event.stopPropagation()
    const arc = document.objects.find((object) => object.type === 'arc' && object.id === id)
    if (!arc || arc.type !== 'arc') return
    const center = resolvePoint(document, arc.center)
    if (!center) return
    const base = documentRef.current
    beginWindowDrag((nextEvent) => {
      const local = toLocal(nextEvent.clientX, nextEvent.clientY)
      const dx = local.x - center.x
      const dy = local.y - center.y
      updateDocument({
        ...documentRef.current,
        objects: documentRef.current.objects.map((object) => {
          if (object.id !== id || object.type !== 'arc') return object
          if (kind === 'radius') return { ...object, radius: Math.max(1, Math.hypot(dx, dy)) }
          if (kind === 'start') return { ...object, startAngle: Math.atan2(dy, dx), startAnchor: undefined }
          return { ...object, endAngle: Math.atan2(dy, dx), endAnchor: undefined }
        })
      })
    }, () => {
      setHistory((items) => ({ past: [...items.past, base], future: [] }))
    })
  }

  const onDerivedPointClick = (id: string, event: React.MouseEvent<SVGCircleElement>): void => {
    event.stopPropagation()
    if (tool === 'splitAtIntersection') {
      const next = materializeIntersection(document, id)
      if (next !== document) commit(next)
      return
    }
    selectObject(id, event)
  }

  const constructionTool = isInteractiveCanvasTool(tool)
  const polygonHint = tool === 'polygon' && polygonSession.vertexIds.length ? t('geometryPolygonHint') : null
  const arcHint = tool === 'arc' && arcStage > 0 ? t('geometryArcHint') : null
  const targetKindLabels: Record<TargetKind, string> = {
    point: t('geometryPoint'),
    segment: t('geometrySegment'),
    circle: t('geometryCircle'),
    arc: t('geometryArc')
  }
  const stepKeys = ['geometrySelectFirst', 'geometrySelectSecond', 'geometrySelectThird'] as const
  const profile = GEOMETRY_TOOLS[tool]
  const constructionHint = constructionTool
    ? constructionSelectionCount >= profile.selects.length
      ? null
      : `${t(stepKeys[constructionSelectionCount])}（${profile.selects[constructionSelectionCount].map((kind) => targetKindLabels[kind]).join(' / ')}）`
    : null
  const hintText = mergeNotice ?? (constructionHint ? `${t('geometryConstructionStep')}: ${constructionHint}` : polygonHint ?? arcHint)

  return (
    <Dialog title={t('drawGeometry')} className="geometry-dialog" onBackdropClick={onClose}>
      <div className="geometry-layout">
        <div className="geometry-main">
          <GeometryToolbar
            tool={tool}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onTool={activateTool}
            onShapeKind={setShapeKind}
            onUndo={undo}
            onRedo={redo}
          />
          <div className="geometry-canvas-wrap">
            <ConstructionHintBar text={hintText} />
            <svg
              ref={canvasRef}
              className="geometry-canvas"
              viewBox={`0 0 ${document.width} ${document.height}`}
              role="img"
              aria-label="几何图画布"
              tabIndex={0}
              onClick={(event) => {
                // 命中缩放/端点/弧手柄的点击只属于拖拽手势，不得触发画布级创建。
                if ((event.target as Element).closest?.('[data-handle]')) return
                if (ellipseClickConsumed.current) {
                  ellipseClickConsumed.current = false
                  return
                }
                if (GEOMETRY_TOOLS[tool].canvasClick === 'arcDraft') {
                  handleArcCanvasClick(event)
                  return
                }
                if (tool === 'shape' && shapeKind === 'ellipse') {
                  handleEllipseClick(event)
                  return
                }
                if (isInteractiveCanvasTool(tool)) {
                  handleConstructionCanvasClick(event)
                  return
                }
                setSelectedIds([])
                setSelectedId(null)
                addAt(event)
              }}
              onMouseDown={(event) => {
                if (GEOMETRY_TOOLS[tool].canvasClick === 'passive' && tool === 'shape' && shapeKind === 'ellipse' && ellipseDraft.current?.focusB) {
                  startEllipseRadiusDrag(event)
                  return
                }
                if (GEOMETRY_TOOLS[tool].canvasClick === 'passive' && tool === 'shape' && shapeKind !== 'ellipse' && beginShapeDraft(event)) return
                startSelectionBox(event)
              }}
              onMouseUp={(event) => {
                if (tool === 'shape' && shapeAnchor) handleShapeMouseUp(event)
              }}
              onMouseMove={(event) => {
                const local = toLocal(event.clientX, event.clientY)
                if (tool === 'polygon' && polygonSession.vertexIds.length) setPolygonCursor(local)
                if (tool === 'shape' && shapeAnchor) setShapeCursor(local)
                if (tool === 'arc' && arcDraftView) setArcCursor(local)
                if (tool === 'shape' && shapeKind === 'ellipse' && ellipseDraft.current?.focusB) {
                  const focusA = resolvePoint(document, ellipseDraft.current.focusA)
                  const focusB = resolvePoint(document, ellipseDraft.current.focusB)
                  if (focusA && focusB) setEllipsePreview({ focusA, focusB, semiMajor: Math.max(Math.hypot(local.x - focusA.x, local.y - focusA.y) + Math.hypot(local.x - focusB.x, local.y - focusB.y), Math.hypot(focusB.x - focusA.x, focusB.y - focusA.y)) / 2 })
                }
                if (tool === 'segment' || tool === 'polygon') {
                  const target = pickGeometryTarget(document, local)
                  setSnapHint(target.type === 'endpoint' || target.type === 'point' ? target.point : null)
                }
              }}
              onMouseLeave={() => {
                setPolygonCursor(null)
                setSnapHint(null)
                setShapeCursor(null)
                setArcCursor(null)
              }}
              onKeyDown={(event) => {
                resizeSelectedCircle(event)
                if (event.key === 'Enter') finishPolygon()
                if (event.key === 'Escape') {
                  cancelPolygon()
                  cancelArcDraft()
                  cancelShapeDraft()
                  cancelEllipseDraft()
                }
                if (event.key === 'Delete' && selectedIds.length) {
                  commit(selectedIds.reduce((current, id) => removeObject(current, id), document))
                  setSelectedIds([])
                  setSelectedId(null)
                }
              }}
            >
              <GeometryPreviewLayers
                selectionBox={selectionBox}
                polygonRubberFrom={tool === 'polygon' && polygonCursor && polygonSession.vertexIds.length >= 1 ? findPoint(document, polygonSession.vertexIds.at(-1)) : null}
                polygonCursor={tool === 'polygon' && polygonSession.vertexIds.length >= 1 ? polygonCursor : null}
                polygonFirstVertex={tool === 'polygon' && polygonCursor && polygonSession.vertexIds.length >= 3 ? findPoint(document, polygonSession.vertexIds[0]) : null}
                snapHint={snapHint}
                arcDraftView={arcDraftView}
                arcCursor={arcCursor}
                shapeKind={shapeKind}
                shapeAnchor={shapeAnchor}
                shapeCursor={shapeCursor}
                ellipsePreview={ellipsePreview}
              />
              <GeometryConstraintMarkers document={document} onRemove={(index) => commit(removeConstraint(document, index))} />
              <GeometryObjects
                document={document}
                tool={tool}
                selectedId={selectedId}
                polygonVertexIds={polygonSession.vertexIds}
                constructionTool={constructionTool}
                onSelectForConstruction={selectForConstruction}
                onSelectObject={selectObject}
                onPointMouseDown={onPointMouseDown}
                onGrabRigid={grabRigid}
                onSegmentEndpointPress={onSegmentEndpointPress}
                onStartCircleResize={startCircleResize}
                onStartArcHandleDrag={startArcHandleDrag}
                onDerivedPointClick={onDerivedPointClick}
              />
            </svg>
          </div>
        </div>
        <GeometrySidePanel document={document} selectedIds={selectedIds} commit={commit} onClearSelection={() => { setSelectedIds([]); setSelectedId(null) }} />
      </div>
      <div className="geometry-dialog-actions">
        <button type="button" onClick={onClose}>取消</button>
        <button type="button" onClick={() => onSave(renderGeometrySvg(document))}>插入</button>
      </div>
    </Dialog>
  )
}

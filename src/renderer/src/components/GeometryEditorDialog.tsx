import { useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import {
  GEOMETRY_TOOLS,
  acceptsTarget,
  addArc,
  addEllipse,
  addConstraint,
  addPoint,
  addSegment,
  addText,
  angleBetweenPoints,
  appendPolygonVertex,
  buildShape,
  canFinishPolygon,
  checkMergePoints,
  closePolygonSession,
  createGeometryDocument,
  findConstrainedShapeCycle,
  findAttachedSegment,
  findAttachedArc,
  projectPointToArc,
  projectAttachedCurvePoint,
  getShapeInteraction,
  findPolygonAtPoint,
  findPolygonCycle,
  getGeometryObject,
  getGeometryObjects,
  intersectSegments,
  mirrorObjects,
  hitTest,
  isAxisResizableRectangle,
  isInteractiveCanvasTool,
  isSimpleCycle,
  mergePoints,
  mergePointsWithConstraints,
  splitNode,
  movePoint,
  polygonCycleSegmentIds,
  pickGeometryTarget,
  removeConstraint,
  removeObject,
  renderGeometrySvg,
  resizeCircle,
  resolvePoint,
  resolveEllipseGeometry,
  rotateAboutPivot,
  scaleAboutAnchor,
  solveGeometry,
  stretchAboutAnchor,
  type GeometryDocument,
  type GeometryToolId,
  type TargetKind
} from '../geometry'
import type { ShapeKind } from '../geometry/core/shapeFactory'
import { setCircleRadius, setEllipseSemiMajor, setTextPosition, setTextStyle } from '../geometry/core/propertyCommands'
import { useI18n } from '../i18n'
import { ConstructionHintBar } from './geometry/ConstructionHintBar'
import { GeometryToolbar } from './geometry/GeometryToolbar'
import { GeometryPreviewLayers, findPoint } from './geometry/GeometryPreviewLayers'
import { GeometryObjects } from './geometry/GeometryObjects'
import { GeometryConstraintMarkers } from './geometry/GeometryConstraintMarkers'
import { GeometrySidePanel } from './geometry/GeometrySidePanel'
import { GeometryDrawingToolsPanel } from './geometry/GeometryDrawingToolsPanel'
import { GeometryCanvas } from './geometry/GeometryCanvas'
import { GeometryDialogActions } from './geometry/GeometryDialogActions'
import { useGeometryDrag } from '../hooks/useGeometryDrag'
import { useGeometryDocumentState } from '../hooks/useGeometryDocumentState'
import { useGeometrySelectionState } from '../hooks/useGeometrySelectionState'
import { useGeometryCanvasCoordinates } from '../hooks/useGeometryCanvasCoordinates'
import { useGeometryCanvasState } from '../hooks/useGeometryCanvasState'
import { useGeometryToolState } from '../hooks/useGeometryToolState'
import { useGeometryPointDragState } from '../hooks/useGeometryPointDragState'

type Props = { onClose: () => void; onSave: (svg: string) => void | Promise<void>; initialDocument?: GeometryDocument; initialTool?: GeometryToolId; existingPath?: string }

export function GeometryEditorDialog({ onClose, onSave, initialDocument, initialTool = 'point', existingPath }: Props): React.JSX.Element {
  const { t } = useI18n()
  const { beginWindowDrag, beginTrackedDrag } = useGeometryDrag()
  const { document, documentRef, history, setHistory, updateDocument, previewDocument, commit, undo, redo } = useGeometryDocumentState(initialDocument ?? createGeometryDocument())
  const [tool, setTool] = useState<GeometryToolId>(initialTool)
  const [shapeKind, setShapeKind] = useState<ShapeKind>('square')
  const { selectedId, setSelectedId, selectedIds, setSelectedIds, selectedObjectsRef, constructionSelectionCount, setConstructionSelectionCount } = useGeometrySelectionState()
  const { canvasRef, selectionDragRef, selectionBox, setSelectionBox, selectionBoxRef } = useGeometryCanvasState()
  const {
    shapeAnchor, setShapeAnchor, shapeCursor, setShapeCursor, segmentCursor, setSegmentCursor,
    polygonSession, setPolygonSession, polygonCursor, setPolygonCursor, textDraft, setTextDraft,
    snapHint, setSnapHint, arcStage, setArcStage, arcDraftView, setArcDraftView, arcCursor,
    setArcCursor, ellipsePreview, setEllipsePreview
  } = useGeometryToolState()
  const { pointDragRef, dragCycleRef, dragStartDocumentRef } = useGeometryPointDragState()
  const firstPoint = useRef<string | null>(null)
  const segmentDraft = useRef<{ startId: string; start: { x: number; y: number }; temporary: boolean } | null>(null)
  const segmentClickConsumed = useRef(false)
  const [mergeNotice, setMergeNotice] = useState<string | null>(null)
  const textComposing = useRef(false)
  const finishTextDraftRef = useRef<(draft: typeof textDraft, switchTool?: boolean) => void>(() => undefined)
  const textPromptRef = useRef<HTMLDivElement>(null)
  const mirrorSourceIds = useRef<string[]>([])
  const polygonBaseDocument = useRef<GeometryDocument | null>(null)
  const arcDraft = useRef<{ centerId: string; cx: number; cy: number; radius: number; startAngle: number; startAnchorId?: string; endAnchorId?: string } | null>(null)
  const ellipseDraft = useRef<{ focusA: string; focusB?: string } | null>(null)
  const ellipseBaseDocument = useRef<GeometryDocument | null>(null)
  const ellipseRadiusDragging = useRef(false)
  const ellipseClickConsumed = useRef(false)
  const toLocal = useGeometryCanvasCoordinates(canvasRef)

  const nextPointLabel = (doc: GeometryDocument): string => `P${getGeometryObjects(doc, 'point').length + 1}`

  const returnToSelection = (): void => setTool('select')

  const finishTextDraft = (draft: typeof textDraft, switchTool = true): void => {
    if (!draft) return
    if (draft.value.trim()) {
      const next = addText(documentRef.current, draft.x, draft.y, draft.value)
      const textId = next.annotations.at(-1)!.id
      commit(next)
      setSelectedId(textId)
      setSelectedIds([textId])
    }
    setTextDraft(null)
    if (switchTool) returnToSelection()
  }
  useEffect(() => {
    finishTextDraftRef.current = finishTextDraft
  })

  useEffect(() => {
    if (!textDraft) return
    const finishOutside = (event: MouseEvent): void => {
      if (textPromptRef.current?.contains(event.target as Node)) return
      finishTextDraftRef.current(textDraft)
    }
    globalThis.document.addEventListener('mousedown', finishOutside)
    return () => globalThis.document.removeEventListener('mousedown', finishOutside)
  }, [textDraft])

  const discardPolygonDraft = (): void => {
    const base = polygonBaseDocument.current
    if (base && polygonSession.vertexIds.length) updateDocument(base)
    polygonBaseDocument.current = null
    setPolygonSession({ vertexIds: [] })
    setPolygonCursor(null)
  }
  const finalizePolygon = (): void => {
    if (!canFinishPolygon(polygonSession)) return
    const base = polygonBaseDocument.current ?? documentRef.current
    setHistory((current) => ({ past: [...current.past, base], future: [] }))
    updateDocument(closePolygonSession(documentRef.current, polygonSession))
    polygonBaseDocument.current = null
    setPolygonSession({ vertexIds: [] })
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
        arcDraft.current = { centerId: next.points.at(-1)!.id, cx: target.x, cy: target.y, radius: 0, startAngle: 0 }
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
    returnToSelection()
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
  const finishEllipse = (semiMajor: number): void => {
    const draft = ellipseDraft.current
    if (!draft?.focusB) return
    const focusA = resolvePoint(documentRef.current, draft.focusA)
    const focusB = resolvePoint(documentRef.current, draft.focusB)
    if (!focusA || !focusB) return
    commit(addEllipse(documentRef.current, draft.focusA, draft.focusB, Math.max(1, semiMajor)))
    ellipseBaseDocument.current = null
    ellipseDraft.current = null
    setEllipsePreview(null)
    ellipseRadiusDragging.current = false
    returnToSelection()
  }
  const handleEllipseClick = (event: React.MouseEvent<SVGSVGElement>): void => {
    const local = toLocal(event.clientX, event.clientY)
    const target = pickGeometryTarget(document, local)
    const point = target.type === 'point' || target.type === 'endpoint' ? { id: target.pointId, ...target.point } : null
    if (!ellipseDraft.current) {
      ellipseBaseDocument.current = documentRef.current
      const next = point ? document : addPoint(document, local.x, local.y, nextPointLabel(document))
      ellipseDraft.current = { focusA: point?.id ?? next.points.at(-1)!.id }
      updateDocument(next)
      return
    }
    if (!ellipseDraft.current.focusB) {
      const next = point ? document : addPoint(document, local.x, local.y, nextPointLabel(document))
      ellipseDraft.current = { ...ellipseDraft.current, focusB: point?.id ?? next.points.at(-1)!.id }
      updateDocument(next)
      return
    }
    const focusA = resolvePoint(document, ellipseDraft.current.focusA)
    const focusB = resolvePoint(document, ellipseDraft.current.focusB)
    if (focusA && focusB) {
      const focalDistance = Math.hypot(focusB.x - focusA.x, focusB.y - focusA.y)
      const semiMajor = (Math.hypot(local.x - focusA.x, local.y - focusA.y) + Math.hypot(local.x - focusB.x, local.y - focusB.y)) / 2
      finishEllipse(Math.max(semiMajor, focalDistance / 2))
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
      returnToSelection()
    })
  }
  const startEllipseResize = (id: string, event: React.MouseEvent<SVGCircleElement>): void => {
    const base = documentRef.current
    const ellipse = getGeometryObject(base, id)
    if (!ellipse || ellipse.type !== 'ellipse') return
    const focusA = resolvePoint(base, ellipse.focusA)
    const focusB = resolvePoint(base, ellipse.focusB)
    if (!focusA || !focusB) return
    event.stopPropagation()
    const center = { x: (focusA.x + focusB.x) / 2, y: (focusA.y + focusB.y) / 2 }
    const rotation = Math.atan2(focusB.y - focusA.y, focusB.x - focusA.x)
    const minimum = Math.hypot(focusB.x - focusA.x, focusB.y - focusA.y) / 2
    let changed = false
    beginWindowDrag((nextEvent) => {
      const local = toLocal(nextEvent.clientX, nextEvent.clientY)
      const projection = (local.x - center.x) * Math.cos(rotation) + (local.y - center.y) * Math.sin(rotation)
      const semiMajor = Math.max(minimum, Math.abs(projection))
      if (semiMajor === ellipse.semiMajor) return
      changed = true
      updateDocument(setEllipseSemiMajor(documentRef.current, id, semiMajor))
    }, () => {
      if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] }))
    })
  }
  const startTextDrag = (id: string, event: React.MouseEvent<SVGTextElement>): void => {
    if (tool !== 'move') return
    const text = getGeometryObject(documentRef.current, id)
    if (!text || text.type !== 'text') return
    event.stopPropagation()
    const base = documentRef.current
    const origin = toLocal(event.clientX, event.clientY)
    let moved = false
    beginWindowDrag((nextEvent) => {
      const current = toLocal(nextEvent.clientX, nextEvent.clientY)
      const next = setTextPosition(documentRef.current, id, text.x + current.x - origin.x, text.y + current.y - origin.y)
      moved = true
      updateDocument(next)
    }, () => {
      if (moved) setHistory((items) => ({ past: [...items.past, base], future: [] }))
    })
  }
  const startTextRotate = (id: string, event: React.MouseEvent<SVGTextElement>): void => {
    if (tool !== 'rotate') return
    const base = documentRef.current
    const text = getGeometryObject(base, id)
    if (!text || text.type !== 'text') return
    event.stopPropagation()
    const start = toLocal(event.clientX, event.clientY)
    const startAngle = Math.atan2(start.y - text.y, start.x - text.x)
    const initialRotation = text.rotation ?? 0
    let changed = false
    beginWindowDrag((nextEvent) => {
      const current = toLocal(nextEvent.clientX, nextEvent.clientY)
      const angle = ((Math.atan2(current.y - text.y, current.x - text.x) - startAngle) * 180) / Math.PI
      changed = true
      updateDocument(setTextStyle(documentRef.current, id, { rotation: initialRotation + angle }))
    }, () => {
      if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] }))
    })
  }
  const addPointOnSegment = (id: string, event: React.MouseEvent<SVGElement>): void => {
    if (tool !== 'point') return
    event.stopPropagation()
    const local = toLocal(event.clientX, event.clientY)
    const target = pickGeometryTarget(documentRef.current, local)
    if (target.type !== 'curve' || target.curveId !== id) return
    const pointDocument = addPoint(documentRef.current, target.point.x, target.point.y, nextPointLabel(documentRef.current))
    const pointId = pointDocument.points.at(-1)!.id
    const attachedDocument = {
      ...pointDocument,
      points: pointDocument.points.map((point) => point.id === pointId ? { ...point, role: 'attachment' as const, attachment: { objectId: id, kind: target.type === 'curve' ? (getGeometryObject(pointDocument, id)?.type ?? 'segment') as 'segment' | 'circle' | 'arc' | 'ellipse' : 'segment', parameter: target.parameter } } : point)
    }
    commit(attachedDocument)
    setSelectedId(pointId)
    setSelectedIds([pointId])
    returnToSelection()
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
    returnToSelection()
  }

  const startTranslate = (pointIds: string[], event: React.MouseEvent): void => {
    event.stopPropagation()
    const base = documentRef.current
    const origin = toLocal(event.clientX, event.clientY)
    const translatedIds = new Set(pointIds)
    for (const pointId of pointIds) {
      for (const arc of base.curves.filter((object): object is Extract<typeof object, { type: 'arc' }> => object.type === 'arc' && object.center === pointId)) {
        if (arc.startAnchor) translatedIds.add(arc.startAnchor)
        if (arc.endAnchor) translatedIds.add(arc.endAnchor)
      }
    }
    const anchors = [...translatedIds].map((id) => ({ id, point: resolvePoint(base, id) })).filter((item): item is { id: string; point: { x: number; y: number } } => Boolean(item.point))
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
      updateDocument(solveGeometry(next, next.constraints).document)
    }, () => {
      if (moved) setHistory((items) => ({ past: [...items.past, base], future: [] }))
    })
  }

  const activateTool = (nextTool: GeometryToolId): void => {
    if (textDraft) finishTextDraft(textDraft, false)
    if (nextTool === 'mirror') mirrorSourceIds.current = selectedIds.filter((id) => { const object = getGeometryObject(document, id); return Boolean(object && ['point', 'segment', 'circle'].includes(object.type)) })
    if (tool === 'polygon' && nextTool !== 'polygon' && polygonSession.vertexIds.length) discardPolygonDraft()
    if (tool === 'arc' && nextTool !== 'arc') cancelArcDraft()
    if (tool === 'shape' && nextTool !== 'shape' && ellipseDraft.current) cancelEllipseDraft()
    firstPoint.current = null
    selectedObjectsRef.current = []
    setConstructionSelectionCount(0)
    setMergeNotice(null)
    setSnapHint(null)
    setTool(nextTool)
  }

  const continueSegment = (pointId: string): void => {
    if (firstPoint.current && firstPoint.current !== pointId) {
      commit(addSegment(document, firstPoint.current, pointId))
      firstPoint.current = null
      returnToSelection()
    } else {
      firstPoint.current = pointId
    }
  }
  const continuePolygon = (pointId: string): void => {
    if (polygonSession.vertexIds.length >= 3 && pointId === polygonSession.vertexIds[0]) {
      finalizePolygon()
      returnToSelection()
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
    if (tool === 'point') {
      const target = pickGeometryTarget(document, local)
      if (target.type === 'curve') {
        const curve = getGeometryObject(document, target.curveId)
        if (curve?.type === 'segment' || curve?.type === 'circle' || curve?.type === 'arc' || curve?.type === 'ellipse') {
          const pointDocument = addPoint(document, target.point.x, target.point.y, nextPointLabel(document))
          const pointId = pointDocument.points.at(-1)!.id
          const curveKind = getGeometryObject(pointDocument, target.curveId)?.type
          commit({ ...pointDocument, points: pointDocument.points.map((point) => point.id === pointId ? { ...point, role: 'attachment', attachment: { objectId: target.curveId, kind: curveKind as 'segment' | 'circle' | 'arc' | 'ellipse', parameter: target.parameter } } : point) })
           returnToSelection()
           return
        }
      }
    }
    if (tool === 'text') {
      setTextDraft({ x, y, value: '' })
      return
    }
    const next = addPoint(document, x, y, nextPointLabel(document))
    if (tool === 'point') {
      commit(next)
      setSelectedId(next.points.at(-1)!.id)
      setSelectedIds([next.points.at(-1)!.id])
      returnToSelection()
      return
    }
    if (tool === 'polygon') {
      const firstVertexId = polygonSession.vertexIds[0]
      const firstVertex = getGeometryObject(document, firstVertexId)
      if (polygonSession.vertexIds.length >= 3 && firstVertex && firstVertex.type === 'point' && Math.hypot(x - firstVertex.x, y - firstVertex.y) <= 12) {
        finalizePolygon()
        returnToSelection()
        return
      }
      if (!polygonBaseDocument.current) polygonBaseDocument.current = documentRef.current
      const pointId = next.points.at(-1)!.id
      const prev = polygonSession.vertexIds.at(-1)
      previewDocument(prev ? addSegment(next, prev, pointId) : next)
      setPolygonSession(appendPolygonVertex(polygonSession, pointId))
      return
    }
    if (tool === 'segment' && firstPoint.current) {
      commit(addSegment(next, firstPoint.current, next.points.at(-1)!.id))
      firstPoint.current = null
      returnToSelection()
    } else {
      commit(next)
      setSelectedId(next.points.at(-1)!.id)
      setSelectedIds([next.points.at(-1)!.id])
      if (tool === 'segment') firstPoint.current = next.points.at(-1)!.id
    }
  }

  const startSegmentDraft = (event: React.MouseEvent<SVGSVGElement>): void => {
    if (tool !== 'segment') return
    event.stopPropagation()
    const local = toLocal(event.clientX, event.clientY)
    const snap = pickGeometryTarget(documentRef.current, local)
    if (snap.type === 'endpoint' || snap.type === 'point') {
      const point = resolvePoint(documentRef.current, snap.pointId)
      if (point) segmentDraft.current = { startId: snap.pointId, start: point, temporary: false }
    } else {
      const x = Math.max(0, Math.min(document.width, local.x)); const y = Math.max(0, Math.min(document.height, local.y))
      const next = addPoint(documentRef.current, x, y, nextPointLabel(documentRef.current))
      const pointId = next.points.at(-1)!.id
      segmentDraft.current = { startId: pointId, start: { x, y }, temporary: true }
      updateDocument(next)
    }
    setSegmentCursor({ start: segmentDraft.current?.start ?? { x: local.x, y: local.y }, cursor: local })
  }

  const startSegmentDraftFromPoint = (id: string, event: React.MouseEvent): void => {
    const point = resolvePoint(documentRef.current, id)
    if (tool !== 'segment' || !point) return
    event.stopPropagation()
    segmentDraft.current = { startId: id, start: point, temporary: false }
    setSegmentCursor({ start: point, cursor: point })
  }

  const finishSegmentDraft = (event: React.MouseEvent<SVGSVGElement>): void => {
    const draft = segmentDraft.current
    if (!draft || tool !== 'segment') return
    const local = toLocal(event.clientX, event.clientY)
    if (Math.hypot(local.x - draft.start.x, local.y - draft.start.y) < 6) {
      if (draft.temporary) updateDocument(removeObject(documentRef.current, draft.startId))
      segmentDraft.current = null
      setSegmentCursor(null)
      returnToSelection()
      return
    }
    const snap = pickGeometryTarget(documentRef.current, local)
    let endId: string | null = null
    if (snap.type === 'endpoint' || snap.type === 'point') endId = snap.pointId
    if (!endId) {
      const x = Math.max(0, Math.min(document.width, local.x)); const y = Math.max(0, Math.min(document.height, local.y))
      const next = addPoint(documentRef.current, x, y, nextPointLabel(documentRef.current))
      endId = next.points.at(-1)!.id
      updateDocument(next)
    }
    if (endId !== draft.startId) {
      commit(addSegment(documentRef.current, draft.startId, endId))
      segmentClickConsumed.current = true
    }
    segmentDraft.current = null
    setSegmentCursor(null)
    returnToSelection()
  }

  const finishPolygon = (): void => {
    if (tool !== 'polygon') return
    finalizePolygon()
    returnToSelection()
  }


  const resizeSelectedCircle = (event: React.KeyboardEvent<SVGSVGElement>): void => {
    if (!selectedId || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
    const circle = selectedId ? getGeometryObject(document, selectedId) : undefined
    if (!circle || circle.type !== 'circle') return
    event.preventDefault()
    const delta = event.key === 'ArrowUp' ? 5 : -5
    commit(resizeCircle(document, selectedId, circle.radius + delta))
  }

  const selectObject = (id: string, event: React.MouseEvent): void => {
    if (tool === 'text') {
      return
    }
    if (tool === 'segment' || tool === 'polygon') return
    event.stopPropagation()
    setSelectedId(id)
    setSelectedIds((current) => (event.shiftKey ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id]))
  }


  const selectPolygon = (cycle: string[], event: React.MouseEvent): void => {
    if (tool !== 'select' && tool !== 'move') return
    event.stopPropagation()
    const ids = [...cycle, ...polygonCycleSegmentIds(document, cycle)]
    const nextIds = event.shiftKey
      ? (selectedIds.some((id) => ids.includes(id)) ? selectedIds.filter((id) => !ids.includes(id)) : [...selectedIds, ...ids])
      : ids
    setSelectedIds(nextIds)
    setSelectedId(nextIds[0] ?? null)
  }

  const selectPolygonAt = (event: React.MouseEvent<SVGSVGElement>): boolean => {
    if (tool !== 'select' || event.target !== event.currentTarget) return false
    const cycle = findPolygonAtPoint(document, toLocal(event.clientX, event.clientY))
    if (!cycle) return false
    selectPolygon(cycle, event)
    return true
  }

  const startSelectionBox = (event: React.MouseEvent<SVGSVGElement>): void => {
    if (event.target !== event.currentTarget) return
    const point = toLocal(event.clientX, event.clientY)
    selectionDragRef.current = { x: point.x, y: point.y, additive: event.shiftKey }
    beginWindowDrag((nextEvent) => {
      if (!selectionDragRef.current) return
      const current = toLocal(nextEvent.clientX, nextEvent.clientY)
      const box = {
        x: Math.min(selectionDragRef.current.x, current.x),
        y: Math.min(selectionDragRef.current.y, current.y),
        width: Math.abs(current.x - selectionDragRef.current.x),
        height: Math.abs(current.y - selectionDragRef.current.y)
      }
      selectionBoxRef.current = box
      setSelectionBox(box)
    }, () => {
      if (selectionDragRef.current && selectionBoxRef.current) {
        const box = selectionBoxRef.current
        const selected = [...getGeometryObjects(document, 'point'), ...getGeometryObjects(document, 'text')]
          .filter((object) => {
            const point = object.type === 'point' ? { x: object.x, y: object.y } : object.type === 'text' ? { x: object.x, y: object.y } : null
            return point && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
          })
          .map((object) => object.id)
        const selectedSet = new Set(selected)
        const polygonIds = new Set<string>()
        for (const object of getGeometryObjects(document, 'point')) {
          if (object.type !== 'point' || !selectedSet.has(object.id)) continue
          const cycle = findPolygonCycle(document, object.id)
          if (!cycle || !cycle.every((id) => selectedSet.has(id))) continue
          for (const id of cycle) polygonIds.add(id)
          for (const id of polygonCycleSegmentIds(document, cycle)) polygonIds.add(id)
        }
        const grouped = [...new Set([...selected, ...polygonIds])]
        const ids = selectionDragRef.current.additive ? [...new Set([...selectedIds, ...grouped])] : grouped
        setSelectedIds(ids)
        setSelectedId(ids[0] ?? null)
      }
      selectionDragRef.current = null
      selectionBoxRef.current = null
      setSelectionBox(null)
    })
  }

  const advanceConstructionSelection = (id: string): void => {
    const profile = GEOMETRY_TOOLS[tool]
    if (selectedObjectsRef.current.includes(id)) return
    selectedObjectsRef.current = [...selectedObjectsRef.current, id]
    const selected = selectedObjectsRef.current
    setConstructionSelectionCount(selected.length)
    setSelectedIds(selected)
    setSelectedId(id)
    if (selected.length < profile.selects.length) return
    if (tool === 'coincident') {
      const rejection = checkMergePoints(documentRef.current, selected[0], selected[1])
      if (rejection) {
        setMergeNotice(t(rejection === 'sameSegment' ? 'geometryMergeSameSegment' : 'geometryMergeDigon'))
        resetConstructionSelection()
        return
      }
    }
    const solved = profile.solveOnCreate ? solveGeometry(buildFromSelection(tool, selected)).document : buildFromSelection(tool, selected)
    finishConstruction(solved)
  }
  const resetConstructionSelection = (): void => {
    selectedObjectsRef.current = []
    setConstructionSelectionCount(0)
    setSelectedIds([])
  }

  const finishConstruction = (next: GeometryDocument, createdIds: readonly string[] = []): void => {
    commit(next)
    resetConstructionSelection()
    setSelectedId(createdIds[0] ?? null)
    setSelectedIds([...createdIds])
    setMergeNotice(null)
    setSnapHint(null)
    returnToSelection()
  }

  const constructMidpoint = (segmentId: string): void => {
    const base = documentRef.current
    const segment = getGeometryObject(base, segmentId)
    if (!segment || segment.type !== 'segment') return
    const start = resolvePoint(base, segment.start); const end = resolvePoint(base, segment.end)
    if (!start || !end) return
    const pointDocument = addPoint(base, (start.x + end.x) / 2, (start.y + end.y) / 2, nextPointLabel(base))
    const pointId = pointDocument.points.at(-1)!.id
    finishConstruction(addConstraint(pointDocument, { type: 'midpoint', point: pointId, line: segment.id }), [pointId])
  }

  const selectForConstruction = (id: string, event: React.MouseEvent): void => {
    const profile = GEOMETRY_TOOLS[tool]
    if (tool === 'text') {
      return
    }
    if (tool === 'select' || tool === 'move') {
      selectObject(id, event)
      return
    }
    if (profile.canvasClick === 'draw') {
      const objectType = getGeometryObject(document, id)?.type
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
    if (tool === 'midpoint') {
      const object = getGeometryObject(documentRef.current, id)
      if (object?.type === 'segment') constructMidpoint(object.id)
      return
    }
    if (profile.canvasClick === 'arcDraft') {
      const point = getGeometryObject(document, id)
      if (point && point.type === 'point') advanceArc({ id: point.id, x: point.x, y: point.y })
      return
    }
    setMergeNotice(null)
    const object = getGeometryObject(document, id)
     const targetKind = object?.type as TargetKind | undefined
    if (!targetKind || !acceptsTarget(profile, selectedObjectsRef.current.length, targetKind)) return
    advanceConstructionSelection(id)
  }

  const buildFromSelection = (id: GeometryToolId, selection: string[]): GeometryDocument => {
    const base = documentRef.current
    switch (id) {
      case 'intersection':
        {
          const first = getGeometryObject(base, selection[0])
          const second = getGeometryObject(base, selection[1])
          if (!first || !second || first.type !== 'segment' || second.type !== 'segment') return base
          const point = intersectSegments(base, first, second)
          if (!point) return base
          const firstEndpointId = [first.start, first.end].find((id) => {
            const endpoint = resolvePoint(base, id)
            return endpoint && Math.hypot(endpoint.x - point.x, endpoint.y - point.y) <= 1e-6
          })
          const secondEndpointId = [second.start, second.end].find((id) => {
            const endpoint = resolvePoint(base, id)
            return endpoint && Math.hypot(endpoint.x - point.x, endpoint.y - point.y) <= 1e-6
          })
          let pointDocument = base
          let pointId: string
          if (firstEndpointId && secondEndpointId) {
            pointId = firstEndpointId
            pointDocument = firstEndpointId === secondEndpointId ? base : mergePoints(base, firstEndpointId, secondEndpointId)
          } else if (firstEndpointId || secondEndpointId) {
            pointId = firstEndpointId ?? secondEndpointId!
          } else {
            pointDocument = addPoint(base, point.x, point.y, nextPointLabel(base))
            pointId = pointDocument.points.at(-1)!.id
          }
          return addConstraint(pointDocument, { type: 'intersection', point: pointId, lineA: first.id, lineB: second.id })
        }
      case 'coincident':
        {
          const firstShape = findConstrainedShapeCycle(base, selection[0])
          const secondShape = findConstrainedShapeCycle(base, selection[1])
          const keep = firstShape ? selection[0] : secondShape ? selection[1] : selection[0]
          const remove = keep === selection[0] ? selection[1] : selection[0]
          return solveGeometry(mergePointsWithConstraints(base, keep, remove)).document
        }
      case 'splitNode':
        return splitNode(base, selection[0], selection[1])
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
        const vertex = getGeometryObject(base, selection[1])
        const armA = getGeometryObject(base, selection[0])
        const armB = getGeometryObject(base, selection[2])
        if (!vertex || vertex.type !== 'point' || !armA || armA.type !== 'point' || !armB || armB.type !== 'point') return base
         return addConstraint(base, { type: 'fixedAngle', a: selection[0], vertex: selection[1], b: selection[2], value: angleBetweenPoints(armA, vertex, armB) })
      }
      case 'mirror': {
        const first = getGeometryObject(base, selection[0])
        const second = getGeometryObject(base, selection[1])
        return first?.type === 'point' && second?.type === 'point'
          ? mirrorObjects(base, mirrorSourceIds.current, first, second)
          : base
      }
      default:
        return base
    }
  }

  const handleConstructionCanvasClick = (event: React.MouseEvent<SVGSVGElement>): void => {
    if (tool === 'horizontal' || tool === 'vertical') {
      const target = pickGeometryTarget(document, toLocal(event.clientX, event.clientY))
      if (target.type !== 'curve' || !document.segments.some((object) => object.id === target.curveId)) return
      finishConstruction(solveGeometry(addConstraint(document, { type: tool, segment: target.curveId })).document)
      return
    }
    if (tool === 'midpoint') {
      const target = pickGeometryTarget(document, toLocal(event.clientX, event.clientY))
      if (target.type !== 'curve' || !document.segments.some((object) => object.id === target.curveId)) return
      constructMidpoint(target.curveId)
       return
    }
    if (!isInteractiveCanvasTool(tool)) return
    const local = toLocal(event.clientX, event.clientY)
    // Use a forgiving hit area because the rendered segment is intentionally thin.
    const hits = hitTest(document, local, 24)
    const profile = GEOMETRY_TOOLS[tool]
    const hit = hits.find((candidate) => {
       const object = getGeometryObject(document, candidate.id)
      if (!object) return false
      return acceptsTarget(profile, selectedObjectsRef.current.length, object.type as TargetKind)
    })
    if (!hit) return
    selectForConstruction(hit.id, event)
  }

  // 受约束闭合图形（形状工具产物）的顶点拖拽：
  // · 矩形 → 对角点固定，宽高分别跟随光标的自由拉伸；
  // · 其余形状 → 以最远顶点为锚点整体等比缩放。
  // 两种均为仿射/相似变换，天然满足各自约束，无需求解器参与。
  const startShapeScaleDrag = (cycle: string[], id: string, event: React.MouseEvent): void => {
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
    const shape = base.shapes.find((item) => item.boundaryPointIds.length === cycle.length && item.boundaryPointIds.every((pointId) => cycle.includes(pointId)))
    if (shape?.kind === 'rightTriangle' && cycle.length === 3) {
      const rightId = cycle.find((pointId) => {
        const incident = base.segments.filter((segment) => segment.start === pointId || segment.end === pointId).filter((segment) => cycle.includes(segment.start) && cycle.includes(segment.end))
        return incident.length === 2 && base.constraints.some((constraint) => constraint.type === 'perpendicular' && ((constraint.lineA === incident[0].id && constraint.lineB === incident[1].id) || (constraint.lineA === incident[1].id && constraint.lineB === incident[0].id)))
      })
      const acuteId = rightId ? cycle.find((pointId) => pointId !== rightId && pointId === id) : undefined
      if (rightId && acuteId) {
        const otherId = cycle.find((pointId) => pointId !== rightId && pointId !== acuteId)
        const right = resolvePoint(base, rightId); const acute = resolvePoint(base, acuteId); const other = otherId ? resolvePoint(base, otherId) : null
        if (!right || !acute || !other) return
        const axis = { x: acute.x - right.x, y: acute.y - right.y }
        const axisLength = Math.hypot(axis.x, axis.y) || 1
        const start = toLocal(event.clientX, event.clientY)
        let changed = false
        beginWindowDrag((nextEvent) => {
          const local = toLocal(nextEvent.clientX, nextEvent.clientY)
          const projection = ((local.x - right.x) * axis.x + (local.y - right.y) * axis.y) / (axisLength * axisLength)
          const next = movePoint(base, acuteId, right.x + axis.x * Math.max(0.02, projection), right.y + axis.y * Math.max(0.02, projection))
          if (Math.hypot(local.x - start.x, local.y - start.y) > 0) changed = true
          updateDocument(next)
        }, () => {
          if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] }))
        })
        return
      }
    }
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
    event.stopPropagation()
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

  const startShapeEdgeDrag = (segmentId: string, event: React.MouseEvent): boolean => {
    const base = documentRef.current
    const segment = getGeometryObject(base, segmentId)
    if (!segment || segment.type !== 'segment') return false
    const explicitShape = base.shapes.find((item) => item.boundarySegmentIds.includes(segmentId) && item.boundaryPointIds.length >= 3)
    const cycle = explicitShape?.boundaryPointIds ?? findConstrainedShapeCycle(base, segment.start) ?? findConstrainedShapeCycle(base, segment.end) ?? findPolygonCycle(base, segment.start)
    if (!cycle) return false
    const shape = base.shapes.find((item) => item.kind === 'rightTriangle' && item.boundaryPointIds.length === cycle.length && item.boundaryPointIds.every((pointId) => cycle.includes(pointId)))
    const cycleSegmentIds = new Set(polygonCycleSegmentIds(base, cycle))
    if (!base.constraints.some((constraint) => Object.values(constraint).some((value) => typeof value === 'string' && cycleSegmentIds.has(value)))) return false
    let index = cycle.findIndex((id, current) => {
      const next = cycle[(current + 1) % cycle.length]
      return (id === segment.start && next === segment.end) || (id === segment.end && next === segment.start)
    })
    if (index < 0) {
      index = cycle.findIndex((id, current) => {
        const previous = cycle[(current + cycle.length - 1) % cycle.length]
        return (id === segment.start && previous === segment.end) || (id === segment.end && previous === segment.start)
      })
    }
    if (index < 0) return false
    const edgeStartId = cycle[index]
    const edgeEndId = cycle[(index + 1) % cycle.length] === segment.start || cycle[(index + 1) % cycle.length] === segment.end
      ? cycle[(index + 1) % cycle.length]
      : cycle[(index + cycle.length - 1) % cycle.length]
    const points = cycle.map((id) => resolvePoint(base, id))
    if (points.some((point) => !point)) return false
    const resolved = points as { x: number; y: number }[]
    const start = toLocal(event.clientX, event.clientY)
    const a = resolvePoint(base, edgeStartId); const b = resolvePoint(base, edgeEndId)
    if (!a || !b) return false
    if (shape?.kind === 'rightTriangle' && cycle.length === 3 && ![edgeStartId, edgeEndId].includes(cycle.find((pointId) => {
      const incident = base.segments.filter((item) => item.start === pointId || item.end === pointId).filter((item) => cycle.includes(item.start) && cycle.includes(item.end))
      return incident.length === 2 && base.constraints.some((constraint) => constraint.type === 'perpendicular' && ((constraint.lineA === incident[0].id && constraint.lineB === incident[1].id) || (constraint.lineA === incident[1].id && constraint.lineB === incident[0].id)))
    }) ?? '')) {
      const rightId = cycle.find((pointId) => {
        const incident = base.segments.filter((item) => item.start === pointId || item.end === pointId).filter((item) => cycle.includes(item.start) && cycle.includes(item.end))
        return incident.length === 2 && base.constraints.some((constraint) => constraint.type === 'perpendicular' && ((constraint.lineA === incident[0].id && constraint.lineB === incident[1].id) || (constraint.lineA === incident[1].id && constraint.lineB === incident[0].id)))
      })!
      const right = resolvePoint(base, rightId)
      const acuteIds = cycle.filter((pointId) => pointId !== rightId)
      const acutePoints = acuteIds.map((pointId) => resolvePoint(base, pointId))
      if (!right || acutePoints.some((point) => !point)) return false
      const resolvedAcute = acutePoints as { x: number; y: number }[]
      const axes = resolvedAcute.map((point) => {
        const length = Math.hypot(point.x - right.x, point.y - right.y) || 1
        return { x: (point.x - right.x) / length, y: (point.y - right.y) / length }
      })
      const startPoint = toLocal(event.clientX, event.clientY)
      let changed = false
      beginWindowDrag((nextEvent) => {
        const local = toLocal(nextEvent.clientX, nextEvent.clientY)
        const dx = local.x - startPoint.x; const dy = local.y - startPoint.y
        const points = resolvedAcute.map((point, index) => {
          const distance = dx * axes[index].x + dy * axes[index].y
          return { x: point.x + axes[index].x * distance, y: point.y + axes[index].y * distance }
        })
        updateDocument(movePoint(movePoint(base, acuteIds[0], points[0].x, points[0].y), acuteIds[1], points[1].x, points[1].y))
        changed = Boolean(dx || dy)
      }, () => {
        if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] }))
      })
      return true
    }
    const center = resolved.reduce((sum, point) => ({ x: sum.x + point.x / cycle.length, y: sum.y + point.y / cycle.length }), { x: 0, y: 0 })
    const interaction = explicitShape ? getShapeInteraction(explicitShape.kind) : null
    const hasEqualLength = interaction?.edgeDrag === 'uniformScale' || base.constraints.some((constraint) => constraint.type === 'equalLength' && (cycleSegmentIds.has(constraint.segmentA) || cycleSegmentIds.has(constraint.segmentB)))
    const isParallelogram = interaction?.edgeDrag === 'freeStretch' && !base.constraints.some((constraint) => constraint.type === 'perpendicular' && cycleSegmentIds.has(constraint.lineA) && cycleSegmentIds.has(constraint.lineB))
    const originalDistance = Math.hypot((a.x + b.x) / 2 - center.x, (a.y + b.y) / 2 - center.y) || 1
    let changed = false
    beginWindowDrag((nextEvent) => {
      const local = toLocal(nextEvent.clientX, nextEvent.clientY)
      let next: GeometryDocument
      if (hasEqualLength) {
        const distance = Math.hypot(local.x - center.x, local.y - center.y)
        next = scaleAboutAnchor(base, cycle, center, Math.max(0.02, distance / originalDistance))
      } else if (isParallelogram) {
        const dx = local.x - start.x; const dy = local.y - start.y
        next = movePoint(movePoint(base, edgeStartId, a.x + dx, a.y + dy), edgeEndId, b.x + dx, b.y + dy)
      } else {
        const ex = b.x - a.x; const ey = b.y - a.y
        const length = Math.hypot(ex, ey) || 1
        const nx = -ey / length; const ny = ex / length
        const delta = (local.x - start.x) * nx + (local.y - start.y) * ny
        next = movePoint(movePoint(base, edgeStartId, a.x + nx * delta, a.y + ny * delta), edgeEndId, b.x + nx * delta, b.y + ny * delta)
      }
      changed = true
      updateDocument(shape ? solveGeometry(next, next.constraints).document : next)
    }, () => {
      if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] }))
    })
    return true
  }

  const startCurveResize = (id: string, event: React.MouseEvent): boolean => {
    const base = documentRef.current
    const object = getGeometryObject(base, id)
    if (!object || (object.type !== 'circle' && object.type !== 'ellipse')) return false
    const center = object.type === 'circle'
      ? resolvePoint(base, object.center)
      : (() => {
          const focusA = resolvePoint(base, object.focusA); const focusB = resolvePoint(base, object.focusB)
          return focusA && focusB ? { x: (focusA.x + focusB.x) / 2, y: (focusA.y + focusB.y) / 2 } : null
        })()
    if (!center) return false
    event.stopPropagation()
    beginTrackedDrag((nextEvent, markChanged) => {
      const local = toLocal(nextEvent.clientX, nextEvent.clientY)
      if (object.type === 'circle') {
        const radius = Math.max(1, Math.hypot(local.x - center.x, local.y - center.y))
        updateDocument(setCircleRadius(documentRef.current, id, radius))
      } else {
        const focusB = resolvePoint(base, object.focusB)
        if (!focusB) return
        const dx = focusB.x - center.x; const dy = focusB.y - center.y
        const length = Math.hypot(dx, dy) || 1
        const projection = ((local.x - center.x) * dx + (local.y - center.y) * dy) / length
        updateDocument(setEllipseSemiMajor(documentRef.current, id, Math.max(length / 2, Math.abs(projection))))
      }
      markChanged()
    }, (changed) => { if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] })) })
    return true
  }

  const startEllipseFocusDrag = (ellipseId: string, focusId: string, event: React.MouseEvent): boolean => {
    const base = documentRef.current
    const ellipse = getGeometryObject(base, ellipseId)
    const focus = getGeometryObject(base, focusId)
    if (!ellipse || ellipse.type !== 'ellipse' || !focus || focus.type !== 'point') return false
    event.stopPropagation()
    const origin = toLocal(event.clientX, event.clientY)
    let changed = false
    beginWindowDrag((nextEvent) => {
      const local = toLocal(nextEvent.clientX, nextEvent.clientY)
      updateDocument(movePoint(documentRef.current, focusId, focus.x + local.x - origin.x, focus.y + local.y - origin.y))
      changed = true
    }, () => {
      if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] }))
    })
    return true
  }

  const grabRigid = (pointIds: string[], event: React.MouseEvent): void => {
    event.stopPropagation()
    if (tool === 'select') {
      const cycle = pointIds
        .map((pointId) => findConstrainedShapeCycle(documentRef.current, pointId))
        .find((candidate) => candidate !== null)
      if (cycle) startTranslate(cycle, event)
      else if (pointIds.length === 1 && documentRef.current.curves.some((object) => (object.type === 'circle' || object.type === 'arc') && object.center === pointIds[0])) startDrag(pointIds[0], event)
      return
    }
    if (tool === 'move') {
      const cycle = pointIds
        .map((pointId) => findConstrainedShapeCycle(documentRef.current, pointId))
        .find((candidate) => candidate !== null)
      startTranslate(cycle ?? pointIds, event)
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
    const segment = getGeometryObject(document, segmentId)
    if (!segment || segment.type !== 'segment') return
    const pointId = endpoint === 'start' ? segment.start : segment.end
    if (tool === 'segment') {
      startSegmentDraftFromPoint(pointId, event)
      return
    }
    if (tool !== 'select') {
      event.stopPropagation()
      return
    }
    const cycle = findConstrainedShapeCycle(documentRef.current, pointId)
    if (cycle && tool === 'select') {
      startShapeRotateDrag(cycle, event)
      return
    }
    startSegmentEndpointDrag(segmentId, endpoint, event)
  }

  const startDrag = (id: string, event: React.MouseEvent, attachedPoint = false): void => {
    if (!attachedPoint && tool !== 'select' && tool !== 'move') return
    const point = getGeometryObject(documentRef.current, id)
    if (!point || point.type !== 'point' || !canvasRef.current) return
    event.stopPropagation()
    if (documentRef.current.constraints.some((constraint) => constraint.type === 'midpoint' && constraint.point === id)) {
      selectObject(id, event)
      return
    }
    if (documentRef.current.curves.some((object) => object.type === 'arc' && object.center === id)) {
      startTranslate([id], event)
      return
    }
    const anchoredArc = documentRef.current.curves.find((object) => object.type === 'arc' && (object.startAnchor === id || object.endAnchor === id))
    if (anchoredArc?.type === 'arc') {
      const base = documentRef.current
      const center = resolvePoint(base, anchoredArc.center)
      if (center) {
        let changed = false
        beginWindowDrag((nextEvent) => {
          const local = toLocal(nextEvent.clientX, nextEvent.clientY)
          const angle = Math.atan2(local.y - center.y, local.x - center.x)
          const pointOnCircle = { x: center.x + anchoredArc.radius * Math.cos(angle), y: center.y + anchoredArc.radius * Math.sin(angle) }
          const moved = movePoint(documentRef.current, id, pointOnCircle.x, pointOnCircle.y)
          const curves = moved.curves.map((object) => {
            if (object.type !== 'arc' || (object.startAnchor !== id && object.endAnchor !== id)) return object
            return object.startAnchor === id
              ? { ...object, startAngle: angle }
              : { ...object, endAngle: angle }
          })
          updateDocument({ ...moved, curves })
          changed = true
        }, () => {
          if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] }))
        })
        return
      }
    }
    const pointOnArc = point.attachment?.kind === 'arc' ? findAttachedArc(documentRef.current, id) : null
    if (pointOnArc) {
      const base = documentRef.current
      let changed = false
      beginWindowDrag((nextEvent) => {
        const projected = projectPointToArc(documentRef.current, id, toLocal(nextEvent.clientX, nextEvent.clientY))
        if (!projected) return
        updateDocument(movePoint(documentRef.current, id, projected.x, projected.y))
        changed = true
      }, () => { if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] })) })
      return
    }
    if (point.attachment?.kind === 'circle' || point.attachment?.kind === 'ellipse') {
      const base = documentRef.current
      let changed = false
      beginWindowDrag((nextEvent) => {
        const projected = projectAttachedCurvePoint(documentRef.current, id, toLocal(nextEvent.clientX, nextEvent.clientY))
        if (!projected) return
        updateDocument(movePoint(documentRef.current, id, projected.x, projected.y))
        changed = true
      }, () => { if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] })) })
      return
    }
    const pointOnLine = findAttachedSegment(documentRef.current, id)
    if (pointOnLine) {
      const { start, end } = pointOnLine
      const base = documentRef.current
      const origin = toLocal(event.clientX, event.clientY)
      let changed = false
      beginWindowDrag((nextEvent) => {
        const local = toLocal(nextEvent.clientX, nextEvent.clientY)
        const dx = end.x - start.x; const dy = end.y - start.y
        const lengthSquared = dx * dx + dy * dy
        if (!lengthSquared) return
        const t = Math.max(0, Math.min(1, ((local.x - start.x) * dx + (local.y - start.y) * dy) / lengthSquared))
        updateDocument(movePoint(documentRef.current, id, start.x + t * dx, start.y + t * dy))
        changed = Math.hypot(local.x - origin.x, local.y - origin.y) > 0
      }, () => {
        if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] }))
      })
      return
    }
    const shapeCycle = findConstrainedShapeCycle(documentRef.current, id)
    if (shapeCycle) {
      startShapeScaleDrag(shapeCycle, id, event)
      return
    }
    const local = toLocal(event.clientX, event.clientY)
    pointDragRef.current = { id, offsetX: local.x - point.x, offsetY: local.y - point.y }
    dragCycleRef.current = findPolygonCycle(documentRef.current, id)
    dragStartDocumentRef.current = document
    beginWindowDrag((nextEvent) => {
      if (!pointDragRef.current || !canvasRef.current) return
      const nextLocal = toLocal(nextEvent.clientX, nextEvent.clientY)
      const moved = movePoint(documentRef.current, id, nextLocal.x - pointDragRef.current.offsetX, nextLocal.y - pointDragRef.current.offsetY)
      const solvedDocument = solveGeometry(moved, moved.constraints, 12, id).document
      if (dragCycleRef.current && !isSimpleCycle(solvedDocument, dragCycleRef.current)) return
      updateDocument(solvedDocument)
    }, () => {
      const solved = solveGeometry(documentRef.current, documentRef.current.constraints, 12, pointDragRef.current?.id)
      if (solved.status === 'solved') updateDocument(solved.document)
      else if (dragStartDocumentRef.current) {
        updateDocument(dragStartDocumentRef.current)
        setMergeNotice(t('geometrySolveRollback'))
      }
      if (dragStartDocumentRef.current && documentRef.current !== dragStartDocumentRef.current) {
        const base = dragStartDocumentRef.current
        setHistory((items) => ({ past: [...items.past, base], future: [] }))
      }
      dragStartDocumentRef.current = null
      pointDragRef.current = null
      dragCycleRef.current = null
    })
  }
  const startAttachedPointDrag = (id: string, event: React.MouseEvent<SVGCircleElement>): void => {
    const attachment = documentRef.current.points.find((point) => point.id === id)?.attachment
    if (!attachment || !['circle', 'arc', 'ellipse'].includes(attachment.kind)) {
      onPointMouseDown(id, event)
      return
    }
    event.stopPropagation()
    const base = documentRef.current
    const curve = base.curves.find((object) => object.id === attachment.objectId)
    if (!curve || curve.type !== attachment.kind) return
    let changed = false
    beginWindowDrag((nextEvent) => {
      const local = toLocal(nextEvent.clientX, nextEvent.clientY)
      const point = attachment.kind === 'arc'
        ? projectPointToArc(documentRef.current, id, local)
        : projectAttachedCurvePoint(documentRef.current, id, local)
      if (!point) return
      const moved = movePoint(documentRef.current, id, point.x, point.y)
      updateDocument({
        ...moved,
        points: moved.points.map((item) => {
          if (item.id !== id || !item.attachment) return item
          const ellipseGeometry = curve.type === 'ellipse' ? resolveEllipseGeometry(documentRef.current, curve) : null
          const currentCenter = curve.type === 'circle' || curve.type === 'arc' ? resolvePoint(documentRef.current, curve.center) : null
          const parameter = curve.type === 'ellipse' && ellipseGeometry
            ? Math.atan2((-(point.x - ellipseGeometry.center.x) * Math.sin(ellipseGeometry.rotation) + (point.y - ellipseGeometry.center.y) * Math.cos(ellipseGeometry.rotation)) / ellipseGeometry.radiusY, ((point.x - ellipseGeometry.center.x) * Math.cos(ellipseGeometry.rotation) + (point.y - ellipseGeometry.center.y) * Math.sin(ellipseGeometry.rotation)) / ellipseGeometry.radiusX)
            : currentCenter ? Math.atan2(point.y - currentCenter.y, point.x - currentCenter.x) : item.attachment.parameter
          return { ...item, attachment: { ...item.attachment, parameter } }
        })
      })
      changed = true
    }, () => { if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] })) })
  }

  const onPointMouseDown = (id: string, event: React.MouseEvent<SVGCircleElement>): void => {
    if (tool === 'text') {
      event.stopPropagation()
      return
    }
    if (tool === 'segment') {
      startSegmentDraftFromPoint(id, event)
      return
    }
    const clickedPoint = getGeometryObject(documentRef.current, id)
    if (clickedPoint?.type === 'point' && clickedPoint.attachment?.kind === 'arc') {
      startAttachedPointDrag(id, event)
      return
    }
    if (tool !== 'select' && tool !== 'move' && tool !== 'rotate' && !(tool === 'shape' && shapeKind === 'ellipse' && ellipseDraft.current?.focusB === id)) {
      event.stopPropagation()
      selectObject(id, event)
      return
    }
    if (tool === 'select') {
      const ellipse = documentRef.current.curves.find((object) => object.type === 'ellipse' && (object.focusA === id || object.focusB === id))
      if (ellipse?.type === 'ellipse' && startEllipseFocusDrag(ellipse.id, id, event)) return
      if (documentRef.current.curves.some((object) => (object.type === 'circle' || object.type === 'arc') && object.center === id)) {
        startDrag(id, event)
        return
      }
      const cycle = findConstrainedShapeCycle(documentRef.current, id)
      if (cycle) {
        startShapeRotateDrag(cycle, event)
        return
      }
      startDrag(id, event)
      return
    }
    if (tool === 'move') {
      const cycle = findConstrainedShapeCycle(documentRef.current, id)
      if (cycle) startTranslate(cycle, event)
      else startDrag(id, event)
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
  }

  const startSegmentEndpointDrag = (segmentId: string, endpoint: 'start' | 'end', event: React.MouseEvent): void => {
    if (tool !== 'select' && tool !== 'move') return
    const segment = getGeometryObject(document, segmentId)
    if (!segment || segment.type !== 'segment') return
    const pointId = endpoint === 'start' ? segment.start : segment.end
    const cycle = findConstrainedShapeCycle(documentRef.current, pointId)
    if (cycle) {
      startShapeRotateDrag(cycle, event)
      return
    }
    const fixedId = endpoint === 'start' ? segment.end : segment.start
    const point = resolvePoint(documentRef.current, pointId)
    if (!point || !resolvePoint(documentRef.current, fixedId)) return
    event.stopPropagation()
    const origin = toLocal(event.clientX, event.clientY)
    const base = documentRef.current
    let changed = false
    beginWindowDrag((nextEvent) => {
      const local = toLocal(nextEvent.clientX, nextEvent.clientY)
      updateDocument(movePoint(documentRef.current, pointId, point.x + local.x - origin.x, point.y + local.y - origin.y))
      changed = true
    }, () => {
      if (changed) setHistory((items) => ({ past: [...items.past, base], future: [] }))
    })
  }

  const startCircleResize = (id: string, event: React.MouseEvent): void => {
    event.stopPropagation()
    const circle = getGeometryObject(document, id)
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
    const arc = getGeometryObject(document, id)
    if (!arc || arc.type !== 'arc') return
    const center = resolvePoint(document, arc.center)
    if (!center) return
    const base = documentRef.current
    beginWindowDrag((nextEvent) => {
      const local = toLocal(nextEvent.clientX, nextEvent.clientY)
      const dx = local.x - center.x
      const dy = local.y - center.y
      const curves = documentRef.current.curves.map((object) => {
        if (object.id !== id || object.type !== 'arc') return object
        if (kind === 'radius') return { ...object, radius: Math.max(1, Math.hypot(dx, dy)) }
        if (kind === 'start') return object.startAnchor ? object : { ...object, startAngle: Math.atan2(dy, dx) }
        return object.endAnchor ? object : { ...object, endAngle: Math.atan2(dy, dx) }
      })
      if (kind !== 'radius') {
        const currentArc = documentRef.current.curves.find((object): object is Extract<typeof object, { type: 'arc' }> => object.id === id && object.type === 'arc')
        const anchorId = currentArc ? kind === 'start' ? currentArc.startAnchor : currentArc.endAnchor : undefined
        if (anchorId && currentArc) {
          const length = Math.hypot(dx, dy) || 1
          updateDocument(movePoint(documentRef.current, anchorId, center.x + (dx / length) * currentArc.radius, center.y + (dy / length) * currentArc.radius))
          return
        }
      }
      updateDocument({ ...documentRef.current, curves })
    }, () => {
      setHistory((items) => ({ past: [...items.past, base], future: [] }))
    })
  }

  const selectArcEndpoint = (id: string, kind: 'start' | 'end', event: React.MouseEvent): void => {
    const arc = getGeometryObject(documentRef.current, id)
    if (!arc || arc.type !== 'arc') return
    event.stopPropagation()
    let pointId = kind === 'start' ? arc.startAnchor : arc.endAnchor
    if (!pointId) {
      const center = resolvePoint(documentRef.current, arc.center)
      if (!center) return
      const angle = kind === 'start' ? arc.startAngle : arc.endAngle
      const endpoint = { x: center.x + arc.radius * Math.cos(angle), y: center.y + arc.radius * Math.sin(angle) }
      const withPoint = addPoint(documentRef.current, endpoint.x, endpoint.y, nextPointLabel(documentRef.current))
      pointId = withPoint.points.at(-1)!.id
      const curves = withPoint.curves.map((curve) => curve.id === id && curve.type === 'arc' ? { ...curve, ...(kind === 'start' ? { startAnchor: pointId } : { endAnchor: pointId }) } : curve)
      commit({ ...withPoint, curves })
    }
    if (tool === 'segment') {
      continueSegment(pointId)
      return
    }
    selectForConstruction(pointId, event)
  }

    const constructionTool = tool !== 'select' && tool !== 'move' && isInteractiveCanvasTool(tool)
  const polygonHint = tool === 'polygon' && polygonSession.vertexIds.length ? t('geometryPolygonHint') : null
  const arcHint = tool === 'arc' && arcStage > 0 ? t('geometryArcHint') : null
  const targetKindLabels: Record<TargetKind, string> = {
    point: t('geometryPoint'),
    segment: t('geometrySegment'),
    circle: t('geometryCircle'),
    ellipse: t('geometryShapeEllipse'),
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
  const handleEscape = (): boolean => {
    const hasActiveAction = polygonSession.vertexIds.length > 0 || arcStage > 0 || Boolean(shapeAnchor) || Boolean(ellipseDraft.current) || constructionSelectionCount > 0 || Boolean(textDraft)
    if (!hasActiveAction) return false
    cancelPolygon()
    cancelArcDraft()
    cancelShapeDraft()
    cancelEllipseDraft()
    resetConstructionSelection()
    setTextDraft(null)
    return true
  }
  const handleCancel = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    cancelPolygon()
    cancelArcDraft()
    cancelShapeDraft()
    cancelEllipseDraft()
    setTextDraft(null)
    onClose()
  }

  return (
    <Dialog title={t('drawGeometry')} className="geometry-dialog" onBackdropClick={onClose} onEscape={handleEscape}>
        <div className="geometry-layout">
         <GeometryDrawingToolsPanel tool={tool} shapeKind={shapeKind} onTool={activateTool} onShapeKind={setShapeKind} />
        <div className="geometry-main">
           <GeometryToolbar
            tool={tool}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onTool={activateTool}
            onUndo={undo}
            onRedo={redo}
          />
           <div>
            {textDraft ? <div ref={textPromptRef} className="geometry-text-prompt" role="dialog" aria-label={t('geometryTextPrompt')} style={{ left: `${(textDraft.x / document.width) * 100}%`, top: `${(textDraft.y / document.height) * 100}%` }}>
              <input autoFocus aria-label={t('geometryTextPrompt')} placeholder={t('geometryTextPrompt')} value={textDraft.value} onChange={(event) => setTextDraft({ ...textDraft, value: event.target.value })} onCompositionStart={() => { textComposing.current = true }} onCompositionEnd={() => { textComposing.current = false }} onBlur={() => finishTextDraft(textDraft)} onKeyDown={(event) => { if (event.key !== 'Enter') return; if (textComposing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) { event.preventDefault(); event.currentTarget.focus(); return }; event.preventDefault(); finishTextDraft(textDraft) }} onClick={(event) => event.stopPropagation()} />
            </div> : null}
            <ConstructionHintBar text={hintText} />
             <GeometryCanvas
               canvasRef={canvasRef}
               width={document.width}
               height={document.height}
               tool={tool}
              onClick={(event) => {
                if (textDraft) {
                  finishTextDraft(textDraft)
                  return
                }
                // 命中缩放/端点/弧手柄的点击只属于拖拽手势，不得触发画布级创建。
                if ((event.target as Element).closest?.('[data-handle]')) return
                if (ellipseClickConsumed.current) {
                  ellipseClickConsumed.current = false
                  return
                }
                if (segmentClickConsumed.current) {
                  segmentClickConsumed.current = false
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
                if (selectPolygonAt(event)) return
                if (isInteractiveCanvasTool(tool)) {
                  handleConstructionCanvasClick(event)
                  return
                }
                setSelectedIds([])
                setSelectedId(null)
                addAt(event)
              }}
              onMouseDown={(event) => {
                if (textDraft) {
                  finishTextDraft(textDraft)
                  return
                }
                if (GEOMETRY_TOOLS[tool].canvasClick === 'passive' && tool === 'shape' && shapeKind === 'ellipse' && ellipseDraft.current?.focusB) {
                  startEllipseRadiusDrag(event)
                  return
                }
                if (GEOMETRY_TOOLS[tool].canvasClick === 'passive' && tool === 'shape' && shapeKind !== 'ellipse' && beginShapeDraft(event)) return
                if (tool === 'segment') {
                  startSegmentDraft(event)
                  return
                }
                startSelectionBox(event)
              }}
              onMouseUp={(event) => {
                 if (tool === 'shape' && shapeAnchor) handleShapeMouseUp(event)
                 if (tool === 'segment') finishSegmentDraft(event)
              }}
              onMouseMove={(event) => {
                const local = toLocal(event.clientX, event.clientY)
                if (tool === 'polygon' && polygonSession.vertexIds.length) setPolygonCursor(local)
                 if (tool === 'shape' && shapeAnchor) setShapeCursor(local)
                 if (tool === 'segment' && segmentDraft.current) setSegmentCursor({ start: segmentDraft.current.start, cursor: local })
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
                  event.preventDefault()
                  event.stopPropagation()
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
                 segmentDraft={segmentCursor}
              />
              <GeometryConstraintMarkers document={document} onRemove={(index) => commit(removeConstraint(document, index))} />
              <GeometryObjects
                document={document}
                tool={tool}
                 selectedIds={selectedIds}
                polygonVertexIds={polygonSession.vertexIds}
                constructionTool={constructionTool}
                onSelectForConstruction={selectForConstruction}
                onSelectObject={selectObject}
                  onPointMouseDown={onPointMouseDown}
                  onAttachedPointMouseDown={startAttachedPointDrag}
           onPointOnSegment={addPointOnSegment}
                onGrabRigid={grabRigid}
                onSegmentEndpointPress={onSegmentEndpointPress}
                onStartCircleResize={startCircleResize}
                   onStartArcHandleDrag={startArcHandleDrag}
                   onSelectArcEndpoint={selectArcEndpoint}
                 onStartEllipseResize={startEllipseResize}
                 onShapeEdgeDrag={startShapeEdgeDrag}
                 onCurveResize={startCurveResize}
                 onSelectPolygon={selectPolygon}
                 onTextMouseDown={startTextDrag}
                 onTextRotateMouseDown={startTextRotate}
               />
             </GeometryCanvas>
          </div>
        </div>
         <GeometrySidePanel document={document} selectedIds={selectedIds} commit={commit} onClearSelection={() => { setSelectedIds([]); setSelectedId(null) }} />
      </div>
       <GeometryDialogActions editing={Boolean(existingPath)} onCancel={handleCancel} onSave={() => onSave(renderGeometrySvg(document))} />
    </Dialog>
  )
}

import { useState } from 'react'
import { createPolygonDrawingSession } from '../geometry'
type Point = { x: number; y: number }
type TextDraft = Point & { value: string }
type SegmentCursor = { start: Point; cursor: Point }
type ArcDraftView = { cx: number; cy: number; radius: number; startAngle: number }
type EllipsePreview = { focusA: Point; focusB: Point; semiMajor: number }

export function useGeometryToolState(): {
  shapeAnchor: Point | null; setShapeAnchor: React.Dispatch<React.SetStateAction<Point | null>>
  shapeCursor: Point | null; setShapeCursor: React.Dispatch<React.SetStateAction<Point | null>>
  segmentCursor: SegmentCursor | null; setSegmentCursor: React.Dispatch<React.SetStateAction<SegmentCursor | null>>
  polygonSession: ReturnType<typeof createPolygonDrawingSession>; setPolygonSession: React.Dispatch<React.SetStateAction<ReturnType<typeof createPolygonDrawingSession>>>
  polygonCursor: Point | null; setPolygonCursor: React.Dispatch<React.SetStateAction<Point | null>>
  textDraft: TextDraft | null; setTextDraft: React.Dispatch<React.SetStateAction<TextDraft | null>>
  snapHint: Point | null; setSnapHint: React.Dispatch<React.SetStateAction<Point | null>>
  arcStage: number; setArcStage: React.Dispatch<React.SetStateAction<number>>
  arcDraftView: ArcDraftView | null; setArcDraftView: React.Dispatch<React.SetStateAction<ArcDraftView | null>>
  arcCursor: Point | null; setArcCursor: React.Dispatch<React.SetStateAction<Point | null>>
  ellipsePreview: EllipsePreview | null; setEllipsePreview: React.Dispatch<React.SetStateAction<EllipsePreview | null>>
} {
  const [shapeAnchor, setShapeAnchor] = useState<Point | null>(null)
  const [shapeCursor, setShapeCursor] = useState<Point | null>(null)
  const [segmentCursor, setSegmentCursor] = useState<SegmentCursor | null>(null)
  const [polygonSession, setPolygonSession] = useState(createPolygonDrawingSession)
  const [polygonCursor, setPolygonCursor] = useState<Point | null>(null)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [snapHint, setSnapHint] = useState<Point | null>(null)
  const [arcStage, setArcStage] = useState(0)
  const [arcDraftView, setArcDraftView] = useState<ArcDraftView | null>(null)
  const [arcCursor, setArcCursor] = useState<Point | null>(null)
  const [ellipsePreview, setEllipsePreview] = useState<EllipsePreview | null>(null)
  return {
    shapeAnchor, setShapeAnchor, shapeCursor, setShapeCursor, segmentCursor, setSegmentCursor,
    polygonSession, setPolygonSession, polygonCursor, setPolygonCursor, textDraft, setTextDraft,
    snapHint, setSnapHint, arcStage, setArcStage, arcDraftView, setArcDraftView, arcCursor,
    setArcCursor, ellipsePreview, setEllipsePreview
  }
}

import { useRef } from 'react'
import type { GeometryDocument } from '../geometry'

type PointDrag = { id: string; offsetX: number; offsetY: number }

export function useGeometryPointDragState(): {
  pointDragRef: React.MutableRefObject<PointDrag | null>
  dragCycleRef: React.MutableRefObject<string[] | null>
  dragStartDocumentRef: React.MutableRefObject<GeometryDocument | null>
} {
  return {
    pointDragRef: useRef<PointDrag | null>(null),
    dragCycleRef: useRef<string[] | null>(null),
    dragStartDocumentRef: useRef<GeometryDocument | null>(null)
  }
}

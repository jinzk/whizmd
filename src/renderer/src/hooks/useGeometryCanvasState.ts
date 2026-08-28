import { useRef, useState } from 'react'

export function useGeometryCanvasState(): {
  canvasRef: React.RefObject<SVGSVGElement | null>
  selectionDragRef: React.MutableRefObject<{ x: number; y: number; additive: boolean } | null>
  selectionBox: { x: number; y: number; width: number; height: number } | null
  setSelectionBox: React.Dispatch<React.SetStateAction<{ x: number; y: number; width: number; height: number } | null>>
  selectionBoxRef: React.MutableRefObject<{ x: number; y: number; width: number; height: number } | null>
} {
  const canvasRef = useRef<SVGSVGElement>(null)
  const selectionDragRef = useRef<{ x: number; y: number; additive: boolean } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const selectionBoxRef = useRef<typeof selectionBox>(null)

  return { canvasRef, selectionDragRef, selectionBox, setSelectionBox, selectionBoxRef }
}

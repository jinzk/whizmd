import { useCallback } from 'react'

type Point = { x: number; y: number }

export function useGeometryCanvasCoordinates(canvasRef: React.RefObject<SVGSVGElement | null>): (clientX: number, clientY: number) => Point {
  return useCallback((clientX: number, clientY: number): Point => {
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
  }, [canvasRef])
}

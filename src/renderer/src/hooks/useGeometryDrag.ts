import { useCallback, useEffect, useRef } from 'react'

type MoveHandler = (event: MouseEvent) => void
type EndHandler = () => void

export function useGeometryDrag() {
  const cleanupRef = useRef<(() => void) | null>(null)

  const beginWindowDrag = useCallback((onMove: MoveHandler, onEnd?: EndHandler): void => {
    cleanupRef.current?.()
    const move = (event: MouseEvent): void => onMove(event)
    const stop = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
      if (cleanupRef.current === cleanup) cleanupRef.current = null
      onEnd?.()
    }
    const cleanup = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
      if (cleanupRef.current === cleanup) cleanupRef.current = null
    }
    cleanupRef.current = cleanup
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }, [])

  useEffect(() => () => cleanupRef.current?.(), [])

  return { beginWindowDrag }
}

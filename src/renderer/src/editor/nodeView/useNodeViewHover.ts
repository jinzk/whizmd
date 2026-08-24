import { useEffect, useRef, useState } from 'react'

export function useNodeViewHover(delay = 350) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])
  const show = (): void => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setVisible(true)
  }
  const hide = (): void => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(false), delay)
  }
  return { visible, show, hide }
}

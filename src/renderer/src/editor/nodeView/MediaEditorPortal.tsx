import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'

interface Props {
  editor: Editor
  getPos: () => number | undefined
  className: string
  children: React.ReactNode
  onClose: () => void
}

export function MediaEditorPortal({ editor, getPos, className, children, onClose }: Props): React.JSX.Element | null {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = (): void => {
      const pos = getPos()
      if (pos === undefined) return
      const dom = editor.view.nodeDOM(pos)
      if (!(dom instanceof HTMLElement)) return
      const rect = dom.getBoundingClientRect()
      const panel = panelRef.current
      const panelWidth = panel?.offsetWidth ?? 420
      const panelHeight = panel?.offsetHeight ?? 160
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
      const below = rect.bottom + 6
      const top = below + panelHeight <= window.innerHeight - 8
        ? below
        : Math.max(8, rect.top - panelHeight - 6)
      setPosition({ top, left })
    }
    update()
    const frame = window.requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.cancelAnimationFrame(frame)
    }
  }, [editor, getPos, onClose])

  if (!position) return null
  return createPortal(
    <div ref={panelRef} className={className} style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 100 }}>
      {children}
    </div>,
    document.body
  )
}

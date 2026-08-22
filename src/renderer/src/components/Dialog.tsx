import { useEffect, useRef } from 'react'

interface Props {
  title: string
  titleId?: string
  role?: 'dialog' | 'alertdialog'
  className?: string
  onBackdropClick?: () => void
  closeOnEscape?: boolean
  children: React.ReactNode
}

export function Dialog({ title, titleId, role = 'dialog', className = '', onBackdropClick, closeOnEscape = true, children }: Props): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ;(firstFocusable ?? dialogRef.current)?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (closeOnEscape && event.key === 'Escape') onBackdropClick?.()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [closeOnEscape, onBackdropClick])
  return (
    <div className="app-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onBackdropClick?.()
    }}>
      <div ref={dialogRef} tabIndex={-1} className={`app-dialog ${className}`.trim()} role={role} aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

interface Props {
  title: string
  titleId?: string
  role?: 'dialog' | 'alertdialog'
  className?: string
  onBackdropClick?: () => void
  children: React.ReactNode
}

export function Dialog({ title, titleId, role = 'dialog', className = '', onBackdropClick, children }: Props): React.JSX.Element {
  return (
    <div className="app-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onBackdropClick?.()
    }}>
      <div className={`app-dialog ${className}`.trim()} role={role} aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

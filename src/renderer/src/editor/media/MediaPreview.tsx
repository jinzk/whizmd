import type { ReactNode } from 'react'

type MediaPreviewProps = {
  src: string
  alt: string
  title?: string
  failed: boolean
  failedLabel: ReactNode
  emptyLabel: ReactNode
  onError: () => void
  className?: string
  style?: React.CSSProperties
  draggable?: boolean
}

export function MediaPreview({ src, alt, title, failed, failedLabel, emptyLabel, onError, className, style, draggable }: MediaPreviewProps): React.JSX.Element {
  if (!src || failed) {
    return <span className={className ?? (src ? 'image-broken' : 'image-placeholder')}>{src ? failedLabel : emptyLabel}</span>
  }
  return <img className={className} src={src} alt={alt} title={title || undefined} style={style} draggable={draggable} contentEditable={false} onError={onError} />
}

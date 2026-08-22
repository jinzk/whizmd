import { useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useDocumentStore } from '../../store/documents'
import { dirnamePath, isAbsolutePath, resolveRelative } from '../../utils/path'
import { referenceEntry } from '../referenceRegistry'
import { ReferenceStatus } from '../reference/ReferenceStatus'
import { useNodeViewField } from '../nodeView/useNodeViewField'
import { useI18n } from '../../i18n'

function resolveSrc(src: string, docPath: string | null): string {
  src = src.trim()
  if (!src) {
    return ''
  }
  if (/^(https?:|data:|media:|blob:)/i.test(src)) {
    return src
  }
  let absolute: string
  if (isAbsolutePath(src)) {
    absolute = src
  } else if (docPath) {
    absolute = resolveRelative(dirnamePath(docPath), src)
  } else {
    return ''
  }
  return window.markdownApp.mediaUrl(absolute)
}

type ImageNodeViewProps = NodeViewProps

export function ImageNodeView(props: ImageNodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const { node, updateAttributes, deleteNode, selected } = props
  const docPath = useDocumentStore((state) =>
    state.documents.find((document) => document.id === state.activeDocumentId)?.path ?? null
  )

  const srcField = useNodeViewField(String(node.attrs.src ?? ''), (value) => updateAttributes({ src: value }))
  const altField = useNodeViewField(String(node.attrs.alt ?? ''), (value) => updateAttributes({ alt: value }))
  const src = srcField.value
  const alt = altField.value
  const width = node.attrs.width ?? null
  const reference = node.attrs.reference ? referenceEntry(props.editor, String(node.attrs.reference)) : undefined

  // Temporary width applied while dragging; null falls back to the attr.
  const [editing, setEditing] = useState(selected || !src)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const [dragWidth, setDragWidth] = useState<number | null>(null)

  const resolvedSrc = resolveSrc(src, docPath)

  function startResize(e: React.MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const img = imgRef.current
    if (!img) {
      return
    }
    draggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = width ?? img.naturalWidth

    const onMove = (ev: MouseEvent): void => {
      if (!draggingRef.current) {
        return
      }
      const delta = ev.clientX - startXRef.current
      setDragWidth(Math.max(32, Math.round(startWidthRef.current + delta)))
    }
    const onUp = (ev: MouseEvent): void => {
      if (!draggingRef.current) {
        return
      }
      draggingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const delta = ev.clientX - startXRef.current
      const final = Math.max(32, Math.round(startWidthRef.current + delta))
      setDragWidth(null)
      updateAttributes({ width: final })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const effectiveWidth = dragWidth ?? width

  return (
    <NodeViewWrapper
      className="image-node"
      data-selected={selected ? 'true' : 'false'}
      data-image-editing={editing ? 'true' : 'false'}
      onClick={() => setEditing(true)}
    >
      <div className="image-preview" onMouseDown={() => setEditing(true)}>
        {resolvedSrc && failedSrc !== resolvedSrc ? (
          <img
            ref={imgRef}
            src={resolvedSrc}
            alt={alt}
            style={effectiveWidth ? { width: `${effectiveWidth}px` } : undefined}
            contentEditable={false}
            draggable={true}
            onError={() => setFailedSrc(resolvedSrc)}
          />
        ) : (
          <span className={resolvedSrc ? 'image-broken' : 'image-placeholder'}>
             {resolvedSrc ? t('imageLoadFailed', { src }) : t('enterImageAddress')}
          </span>
        )}
        {selected && resolvedSrc ? (
          <span
            className="image-resize-handle"
            onMouseDown={startResize}
             title={t('resizeImage')}
          />
        ) : null}
      </div>
      {editing ? (
        <div
          ref={editorRef}
          className="image-fields"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setEditing(false)
            }
          }}
        >
          <div className="image-field">
             <span>{t('imageAlt')}</span>
            <input
              value={alt}
               aria-label={t('imageAlt')}
               placeholder={t('enterImageAlt')}
                onChange={(event) => altField.change(event.target.value)}
               onKeyDown={altField.onKeyDown}
            />
            <button
              type="button"
              className="block-module-delete image-delete"
               aria-label={t('deleteImage')}
               title={t('deleteImage')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={deleteNode}
            >
               {t('delete')}
            </button>
          </div>
          <label className="image-field">
             <span>{t('imageSrc')}</span>
            <input
              value={src}
               aria-label={t('imageSrc')}
               placeholder={t('enterImageAddress')}
              onChange={(event) => srcField.change(event.target.value)}
              onKeyDown={srcField.onKeyDown}
            />
          </label>
          {node.attrs.reference ? <ReferenceStatus editor={props.editor} id={String(node.attrs.reference)} entry={reference} /> : null}
        </div>
      ) : alt ? (
        <div className="image-caption">{alt}</div>
      ) : null}
    </NodeViewWrapper>
  )
}

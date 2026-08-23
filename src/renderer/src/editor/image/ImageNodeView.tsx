import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useDocumentStore } from '../../store/documents'
import { dirnamePath, isAbsolutePath, mediaUrlToPath, resolveRelative } from '../../utils/path'
import { referenceEntry } from '../referenceRegistry'
import { ReferenceStatus } from '../reference/ReferenceStatus'
import { useNodeViewField } from '../nodeView/useNodeViewField'
import { useI18n } from '../../i18n'
import { decodeUrlPath, encodeUrlValue } from '../../utils/url'

function resolveLocalPath(src: string, docPath: string | null, rootDir: string | null): string {
  src = decodeUrlPath(src.trim())
  if (!src) {
    return ''
  }
  if (/^(https?:|data:|media:|blob:)/i.test(src)) return ''
  let absolute: string
  if (src.startsWith('/') && rootDir) {
    absolute = resolveRelative(rootDir, src)
  } else if (isAbsolutePath(src)) {
    absolute = src
  } else if (docPath) {
    absolute = resolveRelative(dirnamePath(docPath), src)
  } else {
    return ''
  }
  return absolute
}

type ImageNodeViewProps = NodeViewProps

export function ImageNodeView(props: ImageNodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const { node, updateAttributes, deleteNode, selected, editor, getPos } = props
  const docPath = useDocumentStore((state) =>
    state.documents.find((document) => document.id === state.activeDocumentId)?.path ?? null
  )
  const rootDir = useDocumentStore((state) => state.rootDir)

  const srcField = useNodeViewField(String(node.attrs.src ?? ''), (value) => updateAttributes({ src: encodeUrlValue(value) }))
  const altField = useNodeViewField(String(node.attrs.alt ?? ''), (value) => updateAttributes({ alt: value }))
  const titleField = useNodeViewField(String(node.attrs.title ?? ''), (value) => updateAttributes({ title: value || null }))
  const src = srcField.value
  const alt = altField.value
  const width = node.attrs.width ?? null
  const reference = node.attrs.reference ? referenceEntry(props.editor, String(node.attrs.reference)) : undefined

  // Temporary width applied while dragging; null falls back to the attr.
  const [editing, setEditing] = useState(selected || !src)
  const [showEditButton, setShowEditButton] = useState(false)
  const editTimer = useRef<number | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const blurTimer = useRef<number | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const [dragWidth, setDragWidth] = useState<number | null>(null)

  const showEditorControl = (): void => { if (editTimer.current !== null) window.clearTimeout(editTimer.current); setShowEditButton(true) }
  const scheduleHideEditorControl = (): void => { if (editTimer.current !== null) window.clearTimeout(editTimer.current); editTimer.current = window.setTimeout(() => setShowEditButton(false), 350) }

  useEffect(() => () => {
    if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
  }, [])

  useEffect(() => {
    if (!editing) return
    const updateEditing = (): void => {
      const position = getPos()
      if (position === undefined) return
      const selection = editor.state.selection
      const inside = selection.from > position && selection.from < position + node.nodeSize
      if (!inside) setEditing(false)
    }
    editor.on('selectionUpdate', updateEditing)
    return () => { editor.off('selectionUpdate', updateEditing) }
  }, [editing, editor, getPos, node.nodeSize])

  const value = src.trim()
  const displaySrc = /^(https?:|data:|blob:)/i.test(value)
    ? value
    : /^media:/i.test(value)
      ? window.markdownApp.mediaUrl(mediaUrlToPath(value))
    : (() => {
        const localPath = resolveLocalPath(value, docPath, rootDir)
        return localPath ? window.markdownApp.mediaUrl(localPath) : ''
      })()

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
    >
      <div className="image-preview" onMouseEnter={showEditorControl} onMouseLeave={scheduleHideEditorControl}>
        {displaySrc && failedSrc !== displaySrc ? (
          <img
            ref={imgRef}
            src={displaySrc}
            alt={alt}
            title={String(node.attrs.title ?? '') || undefined}
            style={effectiveWidth ? { width: `${effectiveWidth}px` } : undefined}
            contentEditable={false}
            draggable={true}
            onError={() => setFailedSrc(displaySrc)}
          />
        ) : (
          <span className={displaySrc ? 'image-broken' : 'image-placeholder'}>
             {displaySrc ? t('imageLoadFailed', { src }) : t('enterImageAddress')}
          </span>
        )}
        {!editing ? <button type="button" className={`image-edit-button ${showEditButton ? 'visible' : ''}`} aria-label={t('editImage')} title={t('editImage')} onMouseEnter={showEditorControl} onMouseLeave={scheduleHideEditorControl} onMouseDown={(event) => event.preventDefault()} onClick={() => setEditing(true)}>{t('edit')}</button> : null}
        {selected && displaySrc ? (
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
          onFocusCapture={() => {
            if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
          }}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
            blurTimer.current = window.setTimeout(() => {
              if (!editorRef.current?.contains(document.activeElement)) setEditing(false)
            }, 0)
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
          <label className="image-field">
            <span>{t('imageTitle')}</span>
            <input value={titleField.value} aria-label={t('imageTitle')} placeholder={t('enterImageTitle')} onChange={(event) => titleField.change(event.target.value)} onKeyDown={titleField.onKeyDown} />
          </label>
          {node.attrs.reference ? <ReferenceStatus editor={props.editor} id={String(node.attrs.reference)} entry={reference} /> : null}
        </div>
      ) : null}
    </NodeViewWrapper>
  )
}

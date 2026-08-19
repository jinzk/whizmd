import { useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEditorStore } from '../../store/editor'
import { dirnamePath, isAbsolutePath, resolveRelative } from '../../utils/path'

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
  const { node, updateAttributes, deleteNode, selected } = props
  const docPath = useEditorStore((s) => s.docPath)

  const src = node.attrs.src ?? ''
  const alt = node.attrs.alt ?? ''
  const width = node.attrs.width ?? null

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
            {resolvedSrc ? `无法加载图片：${src}` : '输入图片地址'}
          </span>
        )}
        {selected && resolvedSrc ? (
          <span
            className="image-resize-handle"
            onMouseDown={startResize}
            title="拖动调整大小"
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
            <span>图片说明</span>
            <input
              value={alt}
              aria-label="图片说明"
              placeholder="输入图片说明"
              onChange={(event) => updateAttributes({ alt: event.target.value })}
            />
            <button
              type="button"
              className="block-module-delete image-delete"
              aria-label="删除图片模块"
              title="删除图片模块"
              onMouseDown={(event) => event.preventDefault()}
              onClick={deleteNode}
            >
              删除
            </button>
          </div>
          <label className="image-field">
            <span>src</span>
            <input
              value={src}
              aria-label="图片 src"
              placeholder="输入图片地址"
              onChange={(event) => updateAttributes({ src: event.target.value })}
            />
          </label>
        </div>
      ) : alt ? (
        <div className="image-caption">{alt}</div>
      ) : null}
    </NodeViewWrapper>
  )
}

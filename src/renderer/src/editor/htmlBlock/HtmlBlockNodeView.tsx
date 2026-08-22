import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { renderHtmlBlockPreview } from './preview'
import { useI18n } from '../../i18n'

export function HtmlBlockNodeView({ node, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const [editing, setEditing] = useState(node.attrs.htmlEditing === true)
  const source = String(node.attrs.html ?? '')
  const sourceRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectionRef = useRef<{ start: number; end: number } | null>(null)
  const lastSelectionRef = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => {
    // Follow attributes changed by another editor transaction.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditing(node.attrs.htmlEditing === true)
  }, [node.attrs.htmlEditing])

  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    })
    return () => cancelAnimationFrame(frame)
  }, [editing])

  useEffect(() => {
    const selection = selectionRef.current
    const textarea = textareaRef.current
    if (!selection || document.activeElement !== textarea) return
    if (!textarea) return
    const frame = requestAnimationFrame(() => {
      if (document.activeElement !== textarea) return
      const max = textarea.value.length
      textarea.setSelectionRange(Math.min(selection.start, max), Math.min(selection.end, max))
      selectionRef.current = null
    })
    return () => cancelAnimationFrame(frame)
  }, [source])

  return (
    <NodeViewWrapper className="html-block-node" contentEditable={false} data-html-block data-html-editing={editing ? 'true' : 'false'}>
      <div className="html-block-label">HTML</div>
      <div className="html-block-preview">
        <div dangerouslySetInnerHTML={{ __html: renderHtmlBlockPreview(source) }} />
        {!editing ? <button type="button" className="html-block-edit" aria-label={t('editHtmlSource')} title={t('editHtmlSource')} onMouseDown={(event) => event.preventDefault()} onClick={() => updateAttributes({ htmlEditing: true })}>{t('editHtmlSource')}</button> : null}
      </div>
      <div className="html-block-source" ref={sourceRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) { setEditing(false); updateAttributes({ htmlEditing: false }) } }}>
        <div className="html-block-source-header"><span>HTML</span><button type="button" className="block-module-delete" aria-label={t('deleteHtmlModule')} title={t('deleteHtmlModule')} onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>{t('delete')}</button></div>
        <textarea
          ref={textareaRef}
          className="html-block-source-editor"
          value={source}
          aria-label={t('htmlSource')}
          spellCheck={false}
          readOnly={!editing}
          onFocus={() => setEditing(true)}
          onSelect={(event) => {
            lastSelectionRef.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }
          }}
          onChange={(event) => {
            const nextSelection = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }
            const previousSelection = lastSelectionRef.current
            const delta = event.currentTarget.value.length - source.length
            selectionRef.current = previousSelection && nextSelection.start === event.currentTarget.value.length && previousSelection.start < source.length
              ? { start: previousSelection.start + delta, end: previousSelection.end + delta }
              : nextSelection
            updateAttributes({ html: event.currentTarget.value })
          }}
        />
      </div>
    </NodeViewWrapper>
  )
}

import { useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { referenceEntry } from '../referenceRegistry'
import { ReferenceStatus } from '../reference/ReferenceStatus'
import { useNodeViewField } from '../nodeView/useNodeViewField'
import { useI18n } from '../../i18n'

export function LinkNodeView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const textField = useNodeViewField(String(node.attrs.text ?? ''), (value) => updateAttributes({ text: value }))
  const hrefField = useNodeViewField(String(node.attrs.href ?? ''), (value) => updateAttributes({ href: value }))
  const text = textField.value
  const href = hrefField.value
  const [editing, setEditing] = useState(selected || !href)
  const fieldsRef = useRef<HTMLDivElement>(null)
  const reference = node.attrs.reference ? referenceEntry(editor, String(node.attrs.reference)) : undefined

  return (
    <NodeViewWrapper
      as="span"
      className="link-node"
      data-selected={selected ? 'true' : 'false'}
      data-link-editing={editing ? 'true' : 'false'}
      onClick={() => setEditing(true)}
    >
      {editing ? (
        <span
          ref={fieldsRef}
          className="link-fields"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setEditing(false)
            }
          }}
        >
          <span className="link-field">
             <span>{t('linkText')}</span>
              <input value={text} aria-label={t('linkText')} placeholder={t('enterLinkText')} onChange={(event) => textField.change(event.target.value)} onKeyDown={textField.onKeyDown} />
             <button type="button" className="block-module-delete link-delete" aria-label={t('deleteLink')} title={t('deleteLink')} onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>{t('delete')}</button>
          </span>
          {node.attrs.reference ? <ReferenceStatus editor={editor} id={String(node.attrs.reference)} entry={reference} /> : null}
          <span className="link-field">
             <span>{t('linkAddress')}</span>
               <input value={href} aria-label={t('linkAddress')} placeholder="https://example.com" onChange={(event) => hrefField.change(event.target.value)} onKeyDown={hrefField.onKeyDown} />
          </span>
        </span>
      ) : (
        <span className="link-final-wrap">
          <a
            className="link-final"
            href={href || undefined}
            onClick={(event) => event.preventDefault()}
          >
             {text || href || t('unnamedLink')}
          </a>
          <a
            className="link-open-button"
            href={href || undefined}
            target="_blank"
            rel="noreferrer"
             aria-label={t('openLink')}
             title={t('openLink')}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            ↗
          </a>
        </span>
      )}
    </NodeViewWrapper>
  )
}

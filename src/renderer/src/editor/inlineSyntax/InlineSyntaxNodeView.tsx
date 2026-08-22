import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useInlineAtomEditor } from '../nodeView/useInlineAtomEditor'
import { useI18n } from '../../i18n'

const LABEL_KEYS = {
  italic: 'inlineItalic',
  bold: 'inlineBold',
  boldItalic: 'inlineBoldItalic',
  strike: 'inlineStrike',
  highlight: 'inlineHighlight',
  superscript: 'inlineSuperscript',
  subscript: 'inlineSubscript'
} as const

export function InlineSyntaxNodeView({ node, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const labelKey = LABEL_KEYS[String(node.attrs.kind) as keyof typeof LABEL_KEYS]
  const label = labelKey ? t(labelKey) : t('inlineFormat')
  const isDecoration = node.type.name === 'inlineDecoration'
  const nodeClass = isDecoration ? 'inline-decoration-node inline-syntax-node' : 'inline-syntax-node'
  const previewClass = isDecoration ? 'inline-decoration-preview inline-syntax-preview' : 'inline-syntax-preview'
  const valueClass = isDecoration
    ? `inline-decoration-value inline-decoration-${String(node.attrs.kind)}`
    : `inline-syntax-value inline-syntax-${String(node.attrs.kind)}`
  const { editing, setEditing, value, setValue, inputRef, commit, cancel } = useInlineAtomEditor({
    value: String(node.attrs.value ?? ''),
    onCommit: (next) => updateAttributes({ value: next }),
    onDelete: deleteNode
  })

  return (
    <NodeViewWrapper as="span" className={nodeClass} data-editing={editing ? 'true' : 'false'}>
      {editing ? (
        <span className={isDecoration ? 'inline-decoration-edit-controls inline-syntax-edit-controls' : 'inline-syntax-edit-controls'}>
          <span className={isDecoration ? 'inline-decoration-label inline-syntax-label' : 'inline-syntax-label'}>{label}</span>
           <span className="inline-syntax-input-row">
             <input
               ref={inputRef}
               className={isDecoration ? 'inline-decoration-input inline-syntax-input' : 'inline-syntax-input'}
               style={{ width: `${Math.max(3, value.length + 1)}ch` }}
               value={value}
                aria-label={t('editInlineFormat', { label })}
               onChange={(event) => setValue(event.target.value)}
               onBlur={commit}
               onClick={(event) => event.stopPropagation()}
               onKeyDown={(event) => {
                 if (event.key === 'Enter' || event.key === 'Escape') {
                   event.preventDefault()
                   event.key === 'Escape' ? cancel() : commit()
                 }
               }}
             />
             <button
               type="button"
               className={isDecoration ? 'inline-decoration-delete inline-syntax-delete' : 'inline-syntax-delete'}
                aria-label={t('deleteInlineFormat', { label })}
               onMouseDown={(event) => event.preventDefault()}
               onClick={deleteNode}
             >
                {t('delete')}
             </button>
           </span>
        </span>
      ) : (
        <button
          type="button"
          className={previewClass}
           aria-label={t('editInlineFormat', { label })}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setEditing(true)}
        >
          <span className={valueClass}>
            {String(node.attrs.value ?? '')}
          </span>
        </button>
      )}
    </NodeViewWrapper>
  )
}

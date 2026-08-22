import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useInlineAtomEditor } from '../nodeView/useInlineAtomEditor'
import { useI18n } from '../../i18n'
import { katex } from './katex'

export function InlineMathNodeView({ node, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const { editing, setEditing, value, setValue, inputRef, commit, cancel } = useInlineAtomEditor({
    value: String(node.attrs.latex ?? ''),
    onCommit: (latex) => updateAttributes({ latex }),
    onDelete: deleteNode
  })

  const preview = katex.renderToString(String(node.attrs.latex ?? ''), { throwOnError: false, displayMode: false })

  return (
    <NodeViewWrapper as="span" className="inline-math-node" data-editing={editing ? 'true' : 'false'}>
      {editing ? (
        <span className="inline-math-edit-controls">
           <span className="inline-math-label">{t('inlineMath')}</span>
           <span className="inline-math-input-row">
             <input
               ref={inputRef}
               className="inline-math-input"
               style={{ width: `${Math.max(3, value.length + 1)}ch` }}
               value={value}
                aria-label={t('editInlineMath')}
               onChange={(event) => setValue(event.target.value)}
               onBlur={commit}
               onClick={(event) => event.stopPropagation()}
               onKeyDown={(event) => {
                 if (event.key === 'Enter' || event.key === 'Escape') {
                   event.preventDefault()
                    if (event.key === 'Escape') cancel()
                    else commit()
                 }
               }}
             />
             <button
               type="button"
               className="inline-math-delete"
                aria-label={t('deleteInlineMath')}
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
          className="inline-math-preview"
           aria-label={`${t('editInlineMath')} ${String(node.attrs.latex ?? '')}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setEditing(true)}
          dangerouslySetInnerHTML={{ __html: preview || String(node.attrs.latex ?? '') }}
        />
      )}
    </NodeViewWrapper>
  )
}

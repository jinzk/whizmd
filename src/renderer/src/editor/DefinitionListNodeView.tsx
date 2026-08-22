import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useState } from 'react'
import { useNodeViewField } from './nodeView/useNodeViewField'
import { useI18n } from '../i18n'

export function DefinitionListNodeView({ node, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const { t } = useI18n()
  const { value: term, setValue: setTerm } = useNodeViewField(String(node.attrs.term ?? ''), (next) => updateAttributes({ term: next }))

  const commit = (): void => {
    const next = term.trim()
    if (!next) deleteNode()
    else updateAttributes({ term: next })
    setEditing(false)
  }

  return (
    <NodeViewWrapper as="div" className="definition-list-item-node">
      <dt className="definition-list-term">
        {editing ? (
          <input
            autoFocus
            value={term}
             aria-label={t('editTerm')}
            onChange={(event) => setTerm(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); commit() }
              if (event.key === 'Escape') { event.preventDefault(); setTerm(String(node.attrs.term ?? '')); setEditing(false) }
            }}
          />
        ) : (
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setEditing(true)}>
             {node.attrs.term || t('unnamedTerm')}
          </button>
        )}
      </dt>
      <dd className="definition-list-definition">
        <NodeViewContent />
      </dd>
    </NodeViewWrapper>
  )
}

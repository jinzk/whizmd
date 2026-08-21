import katex from 'katex'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useInlineAtomEditor } from '../nodeView/useInlineAtomEditor'

export function InlineMathNodeView({ node, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const { editing, setEditing, value, setValue, inputRef, commit, cancel } = useInlineAtomEditor({
    value: String(node.attrs.latex ?? ''),
    onCommit: (latex) => updateAttributes({ latex }),
    onDelete: deleteNode
  })

  let preview = ''
  try {
    preview = katex.renderToString(String(node.attrs.latex ?? ''), {
      throwOnError: false,
      displayMode: false
    })
  } catch {
    preview = ''
  }

  return (
    <NodeViewWrapper as="span" className="inline-math-node" data-editing={editing ? 'true' : 'false'}>
      {editing ? (
        <span className="inline-math-edit-controls">
          <span className="inline-math-label">公式</span>
           <span className="inline-math-input-row">
             <input
               ref={inputRef}
               className="inline-math-input"
               style={{ width: `${Math.max(3, value.length + 1)}ch` }}
               value={value}
               aria-label="编辑行内公式"
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
               className="inline-math-delete"
               aria-label="删除行内公式"
               onMouseDown={(event) => event.preventDefault()}
               onClick={deleteNode}
             >
               删除
             </button>
           </span>
        </span>
      ) : (
        <button
          type="button"
          className="inline-math-preview"
          aria-label={`编辑公式 ${String(node.attrs.latex ?? '')}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setEditing(true)}
          dangerouslySetInnerHTML={{ __html: preview || String(node.attrs.latex ?? '') }}
        />
      )}
    </NodeViewWrapper>
  )
}

import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useInlineAtomEditor } from '../nodeView/useInlineAtomEditor'

const LABELS: Record<string, string> = {
  italic: '斜体',
  bold: '粗体',
  boldItalic: '粗斜体',
  strike: '删除线',
  highlight: '高亮',
  superscript: '上标',
  subscript: '下标'
}

export function InlineSyntaxNodeView({ node, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const label = LABELS[String(node.attrs.kind)] ?? '行内格式'
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
          <input
            ref={inputRef}
            className={isDecoration ? 'inline-decoration-input inline-syntax-input' : 'inline-syntax-input'}
            value={value}
            aria-label={`编辑${label}`}
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
            aria-label={`删除${label}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={deleteNode}
          >
            删除
          </button>
        </span>
      ) : (
        <button
          type="button"
          className={previewClass}
          aria-label={`编辑${label}`}
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

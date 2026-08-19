import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

const LABELS: Record<string, string> = {
  italic: '斜体',
  bold: '粗体',
  boldItalic: '粗斜体',
  strike: '删除线'
}

export function InlineSyntaxNodeView({ node, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const label = LABELS[String(node.attrs.kind)] ?? '行内格式'
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(node.attrs.value ?? ''))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setValue(String(node.attrs.value ?? ''))
  }, [editing, node.attrs.value])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = (): void => {
    const next = value.trim()
    if (!next) deleteNode()
    else {
      updateAttributes({ value: next })
      setEditing(false)
    }
  }

  const cancel = (): void => {
    setValue(String(node.attrs.value ?? ''))
    setEditing(false)
  }

  return (
    <NodeViewWrapper as="span" className="inline-syntax-node" data-editing={editing ? 'true' : 'false'}>
      {editing ? (
        <span className="inline-syntax-edit-controls">
          <span className="inline-syntax-label">{label}</span>
          <input
            ref={inputRef}
            className="inline-syntax-input"
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
            className="inline-syntax-delete"
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
          className="inline-syntax-preview"
          aria-label={`编辑${label}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setEditing(true)}
        >
          <span className={`inline-syntax-value inline-syntax-${String(node.attrs.kind)}`}>
            {String(node.attrs.value ?? '')}
          </span>
        </button>
      )}
    </NodeViewWrapper>
  )
}

import katex from 'katex'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

export function InlineMathNodeView({ node, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(node.attrs.latex ?? ''))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) {
      setValue(String(node.attrs.latex ?? ''))
    }
  }, [editing, node.attrs.latex])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = (): void => {
    const latex = value.trim()
    if (!latex) {
      deleteNode()
    } else if (latex !== node.attrs.latex) {
      updateAttributes({ latex })
    }
    setEditing(false)
  }

  const cancel = (): void => {
    setValue(String(node.attrs.latex ?? ''))
    setEditing(false)
  }

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
          <input
            ref={inputRef}
            className="inline-math-input"
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

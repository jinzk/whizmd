import { useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

export function LinkNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps): React.JSX.Element {
  const text = String(node.attrs.text ?? '')
  const href = String(node.attrs.href ?? '')
  const [editing, setEditing] = useState(selected || !href)
  const fieldsRef = useRef<HTMLDivElement>(null)

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
            <span>链接文字</span>
            <input value={text} aria-label="链接文字" placeholder="输入链接文字" onChange={(event) => updateAttributes({ text: event.target.value })} />
            <button type="button" className="block-module-delete link-delete" aria-label="删除链接模块" title="删除链接模块" onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>删除</button>
          </span>
          <span className="link-field">
            <span>链接地址</span>
            <input value={href} aria-label="链接地址" placeholder="https://example.com" onChange={(event) => updateAttributes({ href: event.target.value })} />
          </span>
        </span>
      ) : (
        <span className="link-final-wrap">
          <a
            className="link-final"
            href={href || undefined}
            onClick={(event) => event.preventDefault()}
          >
            {text || href || '未命名链接'}
          </a>
          <a
            className="link-open-button"
            href={href || undefined}
            target="_blank"
            rel="noreferrer"
            aria-label="打开链接"
            title="打开链接"
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

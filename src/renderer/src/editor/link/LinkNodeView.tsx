import { useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { referenceEntry } from '../referenceRegistry'
import { ReferenceStatus } from '../reference/ReferenceStatus'
import { useNodeViewField } from '../nodeView/useNodeViewField'

export function LinkNodeView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps): React.JSX.Element {
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
            <span>链接文字</span>
             <input value={text} aria-label="链接文字" placeholder="输入链接文字" onChange={(event) => textField.change(event.target.value)} onKeyDown={textField.onKeyDown} />
            <button type="button" className="block-module-delete link-delete" aria-label="删除链接模块" title="删除链接模块" onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>删除</button>
          </span>
          {node.attrs.reference ? <ReferenceStatus editor={editor} id={String(node.attrs.reference)} entry={reference} /> : null}
          <span className="link-field">
            <span>链接地址</span>
              <input value={href} aria-label="链接地址" placeholder="https://example.com" onChange={(event) => hrefField.change(event.target.value)} onKeyDown={hrefField.onKeyDown} />
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

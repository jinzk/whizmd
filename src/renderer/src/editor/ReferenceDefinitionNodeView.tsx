import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import { useState } from 'react'
import { deleteReferenceDefinition, renameReferenceDefinition } from './reference/referenceCommands'
import { referenceEntry } from './referenceRegistry'
import { useNodeViewField } from './nodeView/useNodeViewField'

export function ReferenceDefinitionNodeView({ node, editor, getPos, selected, updateAttributes }: NodeViewProps): React.JSX.Element {
  const destinationRef = useRef<HTMLInputElement>(null)
  const [id, setId] = useState(String(node.attrs.id ?? ''))
  const destinationField = useNodeViewField(String(node.attrs.destination ?? ''), (value) => updateAttributes({ destination: value }))
  const titleField = useNodeViewField(String(node.attrs.title ?? ''), (value) => updateAttributes({ title: value || null }))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [idError, setIdError] = useState('')
  const entry = referenceEntry(editor, String(node.attrs.id ?? ''))
  useEffect(() => {
    if (selected && !destinationField.value) {
      destinationRef.current?.focus()
    }
  }, [selected, destinationField.value])

  useEffect(() => {
    setId(String(node.attrs.id ?? ''))
  }, [node.attrs.id])

  const commitId = (): void => {
    const nextId = id.trim()
    if (!nextId) {
      setIdError('ID 不能为空')
      return
    }
    const position = getPos()
    if (typeof position !== 'number' || !renameReferenceDefinition(editor, position, nextId)) {
      setId(String(node.attrs.id ?? ''))
      setIdError('引用 ID 已存在或无效')
    }
  }

  return (
    <NodeViewWrapper as="div" className="reference-definition-node">
      <strong className="reference-definition-label">引用定义</strong>
       <label>
         ID
         <input value={id} onChange={(event) => { setId(event.target.value); setIdError('') }} onBlur={commitId} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitId() } if (event.key === 'Escape') { event.preventDefault(); setId(String(node.attrs.id ?? '')); setIdError('') } }} />
         {idError ? <span role="alert">{idError}</span> : null}
      </label>
      <label>
        地址
         <input ref={destinationRef} aria-label="引用地址" value={destinationField.value} onChange={(event) => destinationField.change(event.target.value)} onKeyDown={destinationField.onKeyDown} />
      </label>
      <label>
        标题
         <input value={titleField.value} onChange={(event) => titleField.change(event.target.value)} onKeyDown={titleField.onKeyDown} />
      </label>
       {confirmDelete ? (
         <span>
           <span>该定义仍被引用，删除后引用将变为未定义。</span>
           <button type="button" onClick={() => { const position = getPos(); if (typeof position === 'number') deleteReferenceDefinition(editor, position, true) }}>仍然删除</button>
           <button type="button" onClick={() => setConfirmDelete(false)}>取消</button>
         </span>
       ) : <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
         if (entry?.usages.length) setConfirmDelete(true)
         else { const position = getPos(); if (typeof position === 'number') deleteReferenceDefinition(editor, position, true) }
       }}>删除</button>}
    </NodeViewWrapper>
  )
}

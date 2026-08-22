import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import { useState } from 'react'
import { deleteReferenceDefinition, renameReferenceDefinition } from './reference/referenceCommands'
import { referenceEntry } from './referenceRegistry'
import { useNodeViewField } from './nodeView/useNodeViewField'
import { useI18n } from '../i18n'

export function ReferenceDefinitionNodeView({ node, editor, getPos, selected, updateAttributes }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
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
       setIdError(t('referenceIdEmpty'))
      return
    }
    const position = getPos()
    if (typeof position !== 'number' || !renameReferenceDefinition(editor, position, nextId)) {
      setId(String(node.attrs.id ?? ''))
       setIdError(t('referenceIdInvalid'))
    }
  }

  return (
    <NodeViewWrapper as="div" className="reference-definition-node">
       <strong className="reference-definition-label">{t('referenceDefinition')}</strong>
       <label>
         ID
         <input value={id} onChange={(event) => { setId(event.target.value); setIdError('') }} onBlur={commitId} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitId() } if (event.key === 'Escape') { event.preventDefault(); setId(String(node.attrs.id ?? '')); setIdError('') } }} />
         {idError ? <span role="alert">{idError}</span> : null}
      </label>
      <label>
        地址
         <input ref={destinationRef} aria-label={t('referenceAddress')} value={destinationField.value} onChange={(event) => destinationField.change(event.target.value)} onKeyDown={destinationField.onKeyDown} />
      </label>
         <label>
         {t('referenceTitle')}
         <input value={titleField.value} onChange={(event) => titleField.change(event.target.value)} onKeyDown={titleField.onKeyDown} />
      </label>
       {confirmDelete ? (
         <span>
            <span>{t('referenceStillUsed')}</span>
            <button type="button" onClick={() => { const position = getPos(); if (typeof position === 'number') deleteReferenceDefinition(editor, position, true) }}>{t('forceDelete')}</button>
            <button type="button" onClick={() => setConfirmDelete(false)}>{t('cancel')}</button>
         </span>
       ) : <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
         if (entry?.usages.length) setConfirmDelete(true)
         else { const position = getPos(); if (typeof position === 'number') deleteReferenceDefinition(editor, position, true) }
        }}>{t('deleteReferenceDefinition')}</button>}
    </NodeViewWrapper>
  )
}

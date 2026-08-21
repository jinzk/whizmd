import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { normalizeReferenceId, referenceEntry } from '../referenceRegistry'

export function jumpToReferenceDefinition(editor: Editor, id: string): boolean {
  const position = referenceEntry(editor, id)?.definitionPosition
  if (position === null || position === undefined) return false
  editor.commands.setNodeSelection(position)
  editor.commands.scrollIntoView()
  return true
}

export function createReferenceDefinition(editor: Editor, id: string): { position: number } | null {
  const normalizedId = normalizeReferenceId(id)
  const existing = referenceEntry(editor, normalizedId)
  if (!normalizedId || (existing?.definitionPosition !== null && existing?.definitionPosition !== undefined)) return null

  const nodeType = editor.schema.nodes.referenceDefinition
  if (!nodeType) return null

  const position = editor.state.doc.content.size
  const definition = nodeType.create({ id: id.trim(), destination: '', title: null })
  const transaction = editor.state.tr.insert(position, definition)
  transaction.setSelection(NodeSelection.create(transaction.doc, position))
  editor.view.dispatch(transaction)
  editor.commands.scrollIntoView()
  return { position }
}

export function renameReferenceDefinition(editor: Editor, position: number, nextId: string): boolean {
  const normalizedNextId = normalizeReferenceId(nextId)
  const definition = editor.state.doc.nodeAt(position)
  if (!definition || definition.type.name !== 'referenceDefinition' || !normalizedNextId) return false

  const oldId = normalizeReferenceId(String(definition.attrs.id ?? ''))
  const existing = referenceEntry(editor, normalizedNextId)
  if (normalizedNextId !== oldId && existing?.definitionPosition !== null && existing?.definitionPosition !== undefined) return false

  const updates: Array<{ position: number; node: typeof definition; attrs: Record<string, unknown> }> = [
    { position, node: definition, attrs: { ...definition.attrs, id: nextId.trim() } }
  ]
  editor.state.doc.nodesBetween(0, editor.state.doc.content.size, (node, nodePosition) => {
    if ((node.type.name !== 'linkNode' && node.type.name !== 'image') || normalizeReferenceId(String(node.attrs.reference ?? '')) !== oldId) return
    updates.push({ position: nodePosition, node: node as typeof definition, attrs: { ...node.attrs, reference: nextId.trim() } })
  })
  const transaction = editor.state.tr
  // All updates preserve node size; applying them from the end avoids stale
  // positions and keeps every change in one undoable transaction.
  updates.sort((left, right) => right.position - left.position)
  for (const update of updates) transaction.setNodeMarkup(update.position, undefined, update.attrs)
  editor.view.dispatch(transaction)
  return true
}

export function deleteReferenceDefinition(editor: Editor, position: number, force = false): boolean {
  const definition = editor.state.doc.nodeAt(position)
  if (!definition || definition.type.name !== 'referenceDefinition') return false
  const id = normalizeReferenceId(String(definition.attrs.id ?? ''))
  const entry = referenceEntry(editor, id)
  if (!force && entry?.usages.length) return false
  editor.view.dispatch(editor.state.tr.delete(position, position + definition.nodeSize))
  return true
}

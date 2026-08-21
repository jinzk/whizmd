import type { EditorState } from '@tiptap/pm/state'
import { cellAround } from 'prosemirror-tables'

export type InputContext = {
  position: number
  parentType: string
  inCodeBlock: boolean
  inHtmlBlock: boolean
  inTableCell: boolean
  lineStart: boolean
  selectionEmpty: boolean
}

function hasAncestor(state: EditorState, position: number, names: Set<string>): boolean {
  const resolved = state.doc.resolve(Math.max(0, Math.min(position, state.doc.content.size)))
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    if (names.has(resolved.node(depth).type.name)) return true
  }
  return false
}

export function isInCodeBlock(state: EditorState, position: number): boolean {
  return hasAncestor(state, position, new Set(['codeBlock']))
}

export function isInHtmlBlock(state: EditorState, position: number): boolean {
  const resolved = state.doc.resolve(Math.max(0, Math.min(position, state.doc.content.size)))
  return hasAncestor(state, position, new Set(['htmlBlock'])) ||
    resolved.nodeAfter?.type.name === 'htmlBlock' ||
    resolved.nodeBefore?.type.name === 'htmlBlock'
}

export function isInTableCell(state: EditorState, position: number): boolean {
  return Boolean(cellAround(state.doc.resolve(Math.max(0, Math.min(position, state.doc.content.size)))))
}

export function getInputContext(state: EditorState, position = state.selection.from): InputContext {
  const resolved = state.doc.resolve(Math.max(0, Math.min(position, state.doc.content.size)))
  return {
    position,
    parentType: resolved.parent.type.name,
    inCodeBlock: isInCodeBlock(state, position),
    inHtmlBlock: isInHtmlBlock(state, position),
    inTableCell: isInTableCell(state, position),
    lineStart: resolved.parent.isTextblock && resolved.parentOffset === 0,
    selectionEmpty: state.selection.empty
  }
}

export function canTriggerInlineMarkdown(state: EditorState, position = state.selection.from): boolean {
  const context = getInputContext(state, position)
  return context.selectionEmpty && !context.inCodeBlock && !context.inHtmlBlock
}

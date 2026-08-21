import { InputRule } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { Plugin } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { canTriggerInlineMarkdown } from './context'

export type PairedTriggerRule = {
  marker: string
  priority: number
  accepts: (content: string) => boolean
  createNode: (content: string, state?: EditorState) => ProseMirrorNode | null
}

type PairedMatch = {
  from: number
  to: number
  content: string
  rule: PairedTriggerRule
}

function isEscaped(text: string, index: number): boolean {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashes += 1
  return slashes % 2 === 1
}

function findMatch(text: string, cursor: number, rule: PairedTriggerRule): PairedMatch | null {
  const { marker } = rule
  if (!text.slice(0, cursor).endsWith(marker) || isEscaped(text, cursor - marker.length)) return null

  const closingStart = cursor - marker.length
  for (let opener = closingStart - marker.length; opener >= 0; opener -= 1) {
    if (!text.startsWith(marker, opener) || isEscaped(text, opener)) continue
    if (opener > 0 && text[opener - 1] === marker[0]) continue
    if (closingStart > 0 && text[closingStart - 1] === marker[0]) continue
    const content = text.slice(opener + marker.length, closingStart)
    if (!rule.accepts(content)) continue
    return { from: opener, to: cursor, content, rule }
  }
  return null
}

function findPairedMatch(text: string, cursor: number, rules: PairedTriggerRule[]): PairedMatch | null {
  return rules
    .filter((rule) => text.slice(0, cursor).endsWith(rule.marker))
    .sort((left, right) => right.priority - left.priority)
    .map((rule) => findMatch(text, cursor, rule))
    .find((match): match is PairedMatch => match !== null) ?? null
}

function findMatchAroundCursor(text: string, cursor: number, rules: PairedTriggerRule[]): PairedMatch | null {
  return rules
    .map((rule) => {
      const { marker } = rule
      for (let opener = cursor - marker.length; opener >= 0; opener -= 1) {
        if (!text.startsWith(marker, opener) || isEscaped(text, opener)) continue
        const closingStart = text.indexOf(marker, cursor)
        if (closingStart < 0 || isEscaped(text, closingStart)) return null
        if (opener > 0 && text[opener - 1] === marker[0]) continue
        if (closingStart > 0 && text[closingStart - 1] === marker[0]) continue
        const content = text.slice(opener + marker.length, closingStart)
        if (!rule.accepts(content)) return null
        return { from: opener, to: closingStart + marker.length, content, rule }
      }
      return null
    })
    .sort((left, right) => (right?.rule.priority ?? -1) - (left?.rule.priority ?? -1))
    .find((match): match is PairedMatch => match !== null) ?? null
}

function convertAtCursor(editorState: EditorState, rules: readonly PairedTriggerRule[]): Transaction | null {
  return convertAtPosition(editorState, editorState.selection.from, rules)
}

function convertAtPosition(editorState: EditorState, position: number, rules: readonly PairedTriggerRule[]): Transaction | null {
  const resolved = editorState.doc.resolve(position)
  if (!resolved.parent.isTextblock) return null
  const match = findMatchAroundCursor(resolved.parent.textContent, resolved.parentOffset, [...rules])
  if (!match) return null
  const from = resolved.start() + match.from
  const node = match.rule.createNode(match.content, editorState)
  if (!node) return null
  const transaction = editorState.tr.replaceWith(from, resolved.start() + match.to, node)
  transaction.setSelection(TextSelection.create(transaction.doc, from + node.nodeSize))
  return transaction
}

export function createPairedTriggerInputRule(rules: readonly PairedTriggerRule[]): InputRule {
  // Match every single-character insertion as well so content inserted between
  // pre-existing delimiters can be converted when the pair becomes valid.
  const endingPattern = /(?:==[^=\n]+==|\^[^^\n]+\^|~[^~\n]+~|\$[^$\n]+\$|.)$/

  return new InputRule({
    find: endingPattern,
    handler: ({ state, range, match }) => {
      if (!canTriggerInlineMarkdown(state, range.to)) return
      const resolved = state.doc.resolve(range.to)
      if (!resolved.parent.isTextblock) return

      // InputRule runs before the typed character is inserted into the document.
      // Include that character while matching, then map the local offsets back.
      const inserted = match[0].at(-1) ?? ''
      const before = resolved.parent.textContent.slice(0, resolved.parentOffset)
      const after = resolved.parent.textContent.slice(resolved.parentOffset)
      // Do not close a pair whose delimiters already existed around the cursor.
      // The user may still be composing its content; completion is deferred to
      // ArrowRight, Enter, or blur.
      if (rules.some((rule) => before.endsWith(rule.marker) && after.startsWith(rule.marker))) return
      if (findMatchAroundCursor(before + inserted + after, resolved.parentOffset + 1, [...rules])) return
      const pairedMatch = findPairedMatch(before + inserted, resolved.parentOffset + 1, [...rules])
      if (!pairedMatch) return

      const node = pairedMatch.rule.createNode(pairedMatch.content, state)
      if (!node) return
      const from = resolved.start() + pairedMatch.from
       const to = resolved.start() + pairedMatch.to
      const transaction = state.tr.replaceWith(from, to, node)
      transaction.setSelection(TextSelection.create(transaction.doc, from + node.nodeSize))
    }
  })
}

export function createPairedTriggerExtension(rules: readonly PairedTriggerRule[], name = 'pairedTriggerCompletion'): Extension {
  return Extension.create({
    name,
    addProseMirrorPlugins() {
      return [new Plugin({
        view: (view) => {
          let previousState = view.state
          return {
            update: (updatedView) => {
              const nextState = updatedView.state
              const previousPosition = previousState.selection.from
              const selectionChanged = previousPosition !== nextState.selection.from || previousState.selection.to !== nextState.selection.to
              if (selectionChanged && previousState.doc.eq(nextState.doc) && previousState.selection.empty && nextState.selection.empty) {
                const transaction = convertAtPosition(nextState, previousPosition, rules)
                if (transaction) updatedView.dispatch(transaction)
              }
              previousState = updatedView.state
            }
          }
        },
        props: {
          handleKeyDown: (view, event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'Enter') return false
            const transaction = convertAtCursor(view.state, rules)
            if (!transaction) return false
            view.dispatch(transaction)
            return true
          },
          handleDOMEvents: {
            blur: (view) => {
              const transaction = convertAtCursor(view.state, rules)
              if (transaction) view.dispatch(transaction)
              return false
            }
          }
        }
      })]
    }
  })
}

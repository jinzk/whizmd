import { InputRule, Extension } from '@tiptap/core'
import { TextSelection, Plugin } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { canTriggerInlineMarkdown } from '../context'
import { findMatchAroundCursor, findMatchEndingBeforeCursor, findPairedMatch } from './matcher'
import type { PairedTriggerRule } from './types'

function convertAtPosition(editorState: EditorState, position: number, rules: readonly PairedTriggerRule[]): Transaction | null {
  const resolved = editorState.doc.resolve(position)
  if (!resolved.parent.isTextblock) return null
  const text = resolved.parent.textContent
  const match = findMatchAroundCursor(text, resolved.parentOffset, rules) ?? findMatchEndingBeforeCursor(text, resolved.parentOffset, rules)
  if (!match) return null
  const from = resolved.start() + match.from
  const node = match.rule.createNode(match.content, editorState)
  if (!node) return null
  const transaction = editorState.tr.replaceWith(from, resolved.start() + match.to, node)
  transaction.setSelection(TextSelection.create(transaction.doc, from + node.nodeSize))
  return transaction
}

export function createPairedTriggerInputRule(rules: readonly PairedTriggerRule[]): InputRule {
  return new InputRule({
    find: /(?:==[^=\n]+==|\^[^^\n]+\^|~[^~\n]+~|\$[^$\n]+\$|.)$/,
    handler: ({ state, range, match }) => {
      if (!canTriggerInlineMarkdown(state, range.to)) return
      const resolved = state.doc.resolve(range.to)
      if (!resolved.parent.isTextblock) return
      const inserted = match[0].at(-1) ?? ''
      const before = resolved.parent.textContent.slice(0, resolved.parentOffset)
      const after = resolved.parent.textContent.slice(resolved.parentOffset)
      if (rules.some((rule) => before.endsWith(rule.marker) && after.startsWith(rule.marker))) return
      const pairedMatch = findPairedMatch(before + inserted, resolved.parentOffset + 1, rules)
      if (!pairedMatch) return
      const node = pairedMatch.rule.createNode(pairedMatch.content, state)
      if (!node) return
      const from = resolved.start() + pairedMatch.from
      const transaction = state.tr.replaceWith(from, resolved.start() + pairedMatch.to, node)
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
            const transaction = convertAtPosition(view.state, view.state.selection.from, rules)
            if (!transaction) return false
            view.dispatch(transaction)
            return true
          },
          handleDOMEvents: {
            blur: (view) => {
              const transaction = convertAtPosition(view.state, view.state.selection.from, rules)
              if (transaction) view.dispatch(transaction)
              return false
            }
          }
        }
      })]
    }
  })
}

export type { PairedMatch, PairedTriggerRule } from './types'

import { InputRule, Extension } from '@tiptap/core'
import { TextSelection, Plugin } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { canTriggerInlineMarkdown } from '../context'
import { findMatchAroundCursor, findPairedMatch } from './matcher'
import type { PairedTriggerRule } from './types'

function convertAtCursor(state: EditorState, rules: readonly PairedTriggerRule[]): Transaction | null {
  const { from, empty } = state.selection
  if (!empty) return null
  const resolved = state.doc.resolve(from)
  if (!resolved.parent.isTextblock) return null
  const text = resolved.parent.textContent
  const match = findMatchAroundCursor(text, resolved.parentOffset, rules)
  if (!match) return null
  const node = match.rule.createNode(match.content, state)
  if (!node) return null
  const start = resolved.start() + match.from
  const transaction = state.tr.replaceWith(start, resolved.start() + match.to, node)
  transaction.setSelection(TextSelection.create(transaction.doc, start + node.nodeSize))
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
      if (after) {
        const virtualText = before + inserted + after
        const virtualCursor = before.length + inserted.length
        const pairedMatch = findMatchAroundCursor(virtualText, virtualCursor, rules)
        if (!pairedMatch) return
        const node = pairedMatch.rule.createNode(pairedMatch.content, state)
        if (!node) return
        const from = resolved.start() + pairedMatch.from
        const to = resolved.start() + pairedMatch.to - inserted.length
        const transaction = state.tr.replaceWith(from, to, node)
        transaction.setSelection(TextSelection.create(transaction.doc, from + node.nodeSize))
        return
      }

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

export function createPairedTriggerExtension(rules: readonly PairedTriggerRule[], name: string): Extension {
  return Extension.create({
    name,
    addProseMirrorPlugins() {
      return [new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null
          return convertAtCursor(newState, rules)
        }
      })]
    }
  })
}

export type { PairedMatch, PairedTriggerRule } from './types'

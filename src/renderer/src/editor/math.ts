import { InputRule } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { InlineMath as BaseInlineMath, BlockMath as BaseBlockMath } from '@tiptap/extension-mathematics'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { BlockMathNodeView } from './math/BlockMathNodeView'
import { InlineMathNodeView } from './math/InlineMathNodeView'
import { getInputContext } from './input/context'
import { createPairedTriggerExtension, createPairedTriggerInputRule } from './input/pairedTrigger'
import { inlineAtomKeyboardShortcuts } from './nodeView/inlineAtomKeyboard'

const INLINE_MATH_PATTERN =
  /(?<!\$)\$(?!\$|\s)([^$\n]+?)(?<!\s)\$(?!\$|\d)/

function inlineTokenToJson(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  const latex = (token.latex ?? token.text ?? '').trim()
  return h.createNode('inlineMath', { latex })
}

/**
 * InlineMath uses the node attribute as its only source of truth. The visible
 * dollar delimiters belong to Markdown, never to the ProseMirror document.
 */
export const InlineMath = BaseInlineMath.extend({
  markdownTokenizer: {
    name: 'inlineMath',
    level: 'inline',
    start(src: string): number {
      const match = src.match(/(?<!\$)\$(?!\$|\s)/)
      return match?.index ?? -1
    },
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(INLINE_MATH_PATTERN)
      if (!match || match.index !== 0) {
        return undefined
      }
      return {
        type: 'inlineMath',
        raw: match[0],
        latex: match[1]
      }
    }
  },
  parseMarkdown: inlineTokenToJson,
  renderMarkdown: (node: JSONContent): string => `$${node.attrs?.latex ?? ''}$`,
  addInputRules() {
    return [createPairedTriggerInputRule([{ marker: '$', priority: 100, accepts: (content) => content.length > 0 && !/^\s|\s$/.test(content) && !content.includes('\n') && !content.includes('$'), createNode: (content, state) => state?.schema.nodes.inlineMath.create({ latex: content.trim() }) ?? null }])]
  },
  addExtensions() {
    return [createPairedTriggerExtension([{ marker: '$', priority: 100, accepts: (content) => content.length > 0 && !/^\s|\s$/.test(content) && !content.includes('\n') && !content.includes('$'), createNode: (content, state) => state?.schema.nodes.inlineMath.create({ latex: content.trim() }) ?? null }], 'inlineMathTransactionCompletion')]
  },
  addKeyboardShortcuts() {
    return inlineAtomKeyboardShortcuts(this.type)
  },
  addNodeView() {
    return ReactNodeViewRenderer(InlineMathNodeView)
  }
})

const BLOCK_MATH_PATTERN = /^(\${2,3})(?:\n([\s\S]*?)\n\1|([^$\n]+)\1)\s*/

function blockTokenToJson(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  const latex = (token.latex ?? '').trim()
  return h.createNode('blockMath', { latex })
}

/**
 * BlockMath extended with a `$$$...$$$` markdown spec for round-trip support.
 * Accepts both single-line (`$$$sum_i$$$`) and fenced (`$$$` + newline +
 * latex + newline + `$$$`) forms.
 */
export const BlockMath = BaseBlockMath.extend({
  markdownTokenizer: {
    name: 'blockMath',
    level: 'block',
    start(src: string): number {
      return src.startsWith('$$') ? 0 : -1
    },
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(BLOCK_MATH_PATTERN)
      if (!match) {
        return undefined
      }
      return {
        type: 'blockMath',
        raw: match[0],
        latex: match[2] ?? match[3] ?? ''
      }
    }
  },
  parseMarkdown: blockTokenToJson,
  renderMarkdown: (node: JSONContent): string => `$$\n${node.attrs?.latex ?? ''}\n$$`,
  addNodeView() {
    return ReactNodeViewRenderer(BlockMathNodeView, {
      selectedOnTextSelection: true
    })
  },
  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$$/,
        handler: ({ state, range }) => {
          const context = getInputContext(state, range.from)
          if (context.inCodeBlock || context.inHtmlBlock || context.inTableCell) return
          const $from = state.doc.resolve(range.from)
          const consumesTextblock =
            $from.depth > 0 &&
            $from.parent.isTextblock &&
            range.from === $from.start() &&
            range.to === $from.end()
          const canReplace =
            consumesTextblock &&
            $from.node(-1).canReplaceWith($from.index(-1), $from.indexAfter(-1), this.type)
          const replacementRange = canReplace
            ? { from: $from.before(), to: $from.after() }
            : range
          const transaction = state.tr.replaceRangeWith(
            replacementRange.from,
            replacementRange.to,
            this.type.create({ latex: '' })
          )
          transaction.setSelection(NodeSelection.create(transaction.doc, replacementRange.from))
        }
      })
    ]
  }
})

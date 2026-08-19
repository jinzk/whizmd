import { InputRule } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { InlineMath as BaseInlineMath, BlockMath as BaseBlockMath } from '@tiptap/extension-mathematics'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { BlockMathNodeView } from './math/BlockMathNodeView'

const INLINE_MATH_PATTERN =
  /(?<!\$)\$(?!\s)(?!\d+\$)([^$\n]+?)(?<!\s)\$(?!\d)/

function inlineTokenToJson(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  const latex = (token.latex ?? token.text ?? '').trim()
  return h.createNode('inlineMath', { latex })
}

/**
 * InlineMath extended with a `$...$` markdown spec so it round-trips through
 * the @tiptap/markdown bridge (marked does not understand dollar math by
 * default). A single-dollar input rule is added so typing `$x^2$` converts
 * immediately, mirroring the regex used by migrateMathStrings.
 */
export const InlineMath = BaseInlineMath.extend({
  markdownTokenizer: {
    name: 'inlineMath',
    level: 'inline',
    start(src: string): number {
      let searchFrom = 0
      while (searchFrom < src.length) {
        const index = src.indexOf('$', searchFrom)
        if (index === -1) {
          return -1
        }
        const prev = src[index - 1]
        const next = src[index + 1]
        if ((!prev || prev === ' ') && next && next !== ' ') {
          return index
        }
        searchFrom = index + 1
      }
      return -1
    },
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(INLINE_MATH_PATTERN)
      if (!match) {
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
    return [
      new InputRule({
        find: INLINE_MATH_PATTERN,
        handler: ({ state, range, match }) => {
          const latex = match[1].trim()
          if (!latex) {
            return
          }
          const { tr } = state
          tr.replaceWith(range.from, range.to, this.type.create({ latex }))
        }
      })
    ]
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

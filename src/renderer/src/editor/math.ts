import { InputRule } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { InlineMath as BaseInlineMath, BlockMath as BaseBlockMath } from '@tiptap/extension-mathematics'
import type { Editor, JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { BlockMathNodeView } from './math/BlockMathNodeView'
import { InlineMathNodeView } from './math/InlineMathNodeView'

const INLINE_MATH_PATTERN =
  /(?<!\$)\$(?!\$|\s)(?!\d+\$)([^$\n]+?)(?<!\s)\$(?!\$|\d)/
const INLINE_MATH_INPUT_PATTERN =
  /(?<!\$)\$(?!\$|\s)(?!\d+\$)([^$\n]+?)(?<!\s)\$(?!\$|\d)$/

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
    return [
      new InputRule({
        find: INLINE_MATH_INPUT_PATTERN,
        handler: ({ state, range, match }) => {
          const latex = match[1].trim()
          if (!latex) {
            return
          }
          const { tr } = state
          const mathNode = this.type.create({ latex })
          tr.replaceWith(range.from, range.to, mathNode)
          tr.setSelection(TextSelection.create(tr.doc, range.from + mathNode.nodeSize))
        }
      })
    ]
  },
  addKeyboardShortcuts() {
    const mathType = this.type
    const deleteAdjacent = (direction: 'backward' | 'forward') => ({ editor }: { editor: Editor }) => {
      const { selection } = editor.state
      if (!selection.empty) return false

      if (selection instanceof NodeSelection && selection.node.type === mathType) {
        editor.commands.deleteSelection()
        return true
      }

      const position = selection.from
      const adjacent = direction === 'backward' ? editor.state.doc.nodeAt(position - 1) : editor.state.doc.nodeAt(position)
      if (!adjacent || adjacent.type !== mathType) return false

      const from = direction === 'backward' ? position - adjacent.nodeSize : position
      editor.view.dispatch(editor.state.tr.delete(from, from + adjacent.nodeSize))
      return true
    }

    return {
      Backspace: deleteAdjacent('backward'),
      Delete: deleteAdjacent('forward')
    }
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

import { InputRule, Node } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { LinkNodeView } from './LinkNodeView'
import { canTriggerInlineMarkdown } from '../input/context'

function linkTokenToJson(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('linkNode', { text: token.text ?? '', href: token.href ?? '', reference: token.reference ?? null })
}

export const LinkNode = Node.create({
  priority: 1000,
  name: 'linkNode',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  isolating: true,
  addAttributes() {
    return { text: { default: '' }, href: { default: '' }, reference: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'span[data-link-node]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { 'data-link-node': '', ...HTMLAttributes }, ['a', {}, HTMLAttributes.href]]
  },
  markdownTokenizer: {
    name: 'linkNode',
    level: 'inline',
    start(src: string): number { return src.indexOf('[') },
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(/^\[([^\]]*)\]\(([^)]+)\)/)
      if (match) return { type: 'linkNode', raw: match[0], text: match[1], href: match[2] }
      const reference = src.match(/^\[([^\]]*)\]\[([^\]]+)\]/)
      if (!reference) return undefined
      return { type: 'linkNode', raw: reference[0], text: reference[1], href: reference[2], reference: reference[2] }
    }
  },
  parseMarkdown: linkTokenToJson,
  renderMarkdown: (node: JSONContent): string => node.attrs?.reference
    ? `[${node.attrs?.text ?? ''}][${node.attrs.reference}]`
    : `[${node.attrs?.text ?? ''}](${node.attrs?.href ?? ''})`,
  addInputRules() {
    return [new InputRule({
      find: /(?:^| )\[([^\]]+)\]\[([^\]]+)\]$/,
      handler: ({ state, range, match }) => {
        if (!canTriggerInlineMarkdown(state, range.from)) return
        const start = range.from + match[0].indexOf('[')
        const node = this.type.create({ text: match[1], href: match[2], reference: match[2] })
        const tr = state.tr.replaceWith(start, range.to, node)
        tr.setSelection(TextSelection.create(tr.doc, start + node.nodeSize))
      }
    }), new InputRule({
      find: /(?:^| )\[([^\]\n]*)\]\($/,
      handler: ({ state, range, match }) => {
        if (!canTriggerInlineMarkdown(state, range.from)) return
        const start = range.from + match[0].indexOf('[')
        const transaction = state.tr.replaceRangeWith(
          start,
          range.to,
          this.type.create({ text: match[1], href: '' })
        )
        const position = transaction.mapping.map(start)
        const node = transaction.doc.nodeAt(position)
        if (node) {
          transaction.setSelection(NodeSelection.create(transaction.doc, position))
        }
      }
    })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(LinkNodeView)
  }
})

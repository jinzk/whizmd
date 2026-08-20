import { InputRule, Node } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { LinkNodeView } from './LinkNodeView'

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
      find: /(?:^| )\[$/,
      handler: ({ state, range }) => {
        const transaction = state.tr.replaceRangeWith(
          range.from,
          range.to,
          this.type.create({ text: '', href: '' })
        )
        const position = transaction.mapping.map(range.from)
        if (transaction.doc.nodeAt(position)) {
          transaction.setSelection(NodeSelection.create(transaction.doc, position))
        }
      }
    })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(LinkNodeView)
  }
})

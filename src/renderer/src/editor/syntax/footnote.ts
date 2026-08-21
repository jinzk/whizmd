import { InputRule, Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { FootnoteDefinitionNodeView } from '../FootnoteDefinitionNodeView'
import { FootnoteReferenceNodeView } from '../FootnoteReferenceNodeView'
import { canTriggerInlineMarkdown } from '../input/context'
import { collectIndentedBody, renderBlockContent } from './blockContent'

const FOOTNOTE_REF = /^\[\^([^\]\n]+)\]/
const FOOTNOTE_DEF = /^\[\^([^\]\n]+)\]:[ \t]*(.*)(?:\n|$)/

function footnoteRefToken(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('footnoteReference', { id: token.id ?? token.text ?? '' })
}

function footnoteDefToken(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  const content = h.parseBlockChildren
    ? h.parseBlockChildren(token.tokens ?? [{ type: 'paragraph', raw: token.text ?? '', text: token.text ?? '' }])
    : [{ type: 'paragraph', content: token.text ? [{ type: 'text', text: token.text }] : [] }]
  return { type: 'footnoteDefinition', attrs: { id: token.id ?? '' }, content }
}

export const FootnoteReference = Node.create({
  name: 'footnoteReference', inline: true, group: 'inline', atom: true, selectable: true,
  addAttributes() { return { id: { default: '' } } },
  parseHTML() { return [{ tag: 'sup[data-footnote-reference]' }] },
  renderHTML({ node }) { return ['sup', { 'data-footnote-reference': node.attrs.id }, `[${node.attrs.id}]`] },
  markdownTokenizer: {
    name: 'footnoteReference', level: 'inline', start: (src: string): number => src.indexOf('[^'),
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(FOOTNOTE_REF)
      return match ? { type: 'footnoteReference', raw: match[0], id: match[1], text: match[1] } : undefined
    }
  },
  parseMarkdown: footnoteRefToken,
  renderMarkdown: (node: JSONContent): string => `[^${node.attrs?.id ?? ''}]`,
  addInputRules() {
    return [new InputRule({
      find: /\[\^([^\]\n]+)\]$/,
      handler: ({ state, range, match }) => {
        if (!canTriggerInlineMarkdown(state, range.from)) return
        const node = this.type.create({ id: match[1] })
        const tr = state.tr.replaceWith(range.from, range.to, node)
        tr.setSelection(TextSelection.create(tr.doc, range.from + node.nodeSize))
      }
    })]
  },
  addNodeView() { return ReactNodeViewRenderer(FootnoteReferenceNodeView) }
})

export const FootnoteDefinition = Node.create({
  name: 'footnoteDefinition', group: 'block', isolating: true, content: 'block+',
  addAttributes() { return { id: { default: '' } } },
  parseHTML() { return [{ tag: 'div[data-footnote-definition]' }] },
  renderHTML({ node }) { return ['aside', { 'data-footnote-definition': node.attrs.id }, 0] },
  markdownTokenizer: {
    name: 'footnoteDefinition', level: 'block', start: (src: string): number => src.indexOf('[^'),
    tokenize(src: string, _tokens, helpers): MarkdownToken | undefined {
      const match = src.match(FOOTNOTE_DEF)
      if (!match) return undefined
      const body = collectIndentedBody(src, match[0].length, 4)
      const text = [match[2], body.body].filter(Boolean).join('\n\n')
      return { type: 'footnoteDefinition', raw: body.raw, id: match[1], text, tokens: helpers.blockTokens(text) }
    }
  },
  parseMarkdown: footnoteDefToken,
  renderMarkdown: (node: JSONContent): string => {
    const content = renderBlockContent(node.content)
    const [first, ...rest] = content.split('\n\n')
    const continuation = rest.length ? `\n\n${rest.join('\n\n').split('\n').map((line) => `    ${line}`).join('\n')}` : ''
    return `[^${node.attrs?.id ?? ''}]: ${first ?? ''}${continuation}`
  },
  addNodeView() { return ReactNodeViewRenderer(FootnoteDefinitionNodeView) }
})

import { InputRule, Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { DefinitionListNodeView } from '../DefinitionListNodeView'
import { collectIndentedBody, renderBlockContent } from './blockContent'

const DEFINITION = /^([^\n]+)\n:[ \t]+([^\n]+)(?:\n|$)/

function definitionToken(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  const content = h.parseBlockChildren
    ? h.parseBlockChildren(token.tokens ?? [{ type: 'paragraph', raw: token.text ?? '', text: token.text ?? '' }])
    : [{ type: 'paragraph', content: token.text ? [{ type: 'text', text: token.text }] : [] }]
  return { type: 'definitionListItem', attrs: { term: token.term ?? '' }, content }
}

export const DefinitionListItem = Node.create({
  name: 'definitionListItem', group: 'block', content: 'block+', isolating: true,
  addAttributes() { return { term: { default: '' } } },
  parseHTML() { return [{ tag: 'div[data-definition-list-item]' }] },
  renderHTML({ node }) { return ['div', { 'data-definition-list-item': '', 'data-definition-term': node.attrs.term }, 0] },
  markdownTokenizer: {
    name: 'definitionListItem', level: 'block', start: (src: string): number => src.indexOf('\n:'),
    tokenize(src: string, _tokens, helpers): MarkdownToken | undefined {
      const match = src.match(DEFINITION)
      if (!match) return undefined
      const body = collectIndentedBody(src, match[0].length, 2)
      const text = [match[2], body.body].filter(Boolean).join('\n\n')
      return { type: 'definitionListItem', raw: body.raw, term: match[1], text, tokens: helpers.blockTokens(text) }
    }
  },
  parseMarkdown: definitionToken,
  renderMarkdown: (node: JSONContent): string => `${node.attrs?.term ?? ''}\n: ${renderBlockContent(node.content).replace(/\n/g, '\n  ')}`,
  addInputRules() {
    return [new InputRule({
      find: /^: $/,
      handler: ({ state, range }) => {
        const resolved = state.doc.resolve(range.from)
        if (resolved.parent.type.name !== 'paragraph' || resolved.depth !== 1) return
        const index = resolved.index(0)
        if (index === 0) return
        const previous = resolved.node(0).child(index - 1)
        if (previous.type.name !== 'paragraph' || !previous.textContent.trim()) return
        const currentFrom = resolved.before()
        const previousFrom = currentFrom - previous.nodeSize
        const content = this.type.schema.nodes.paragraph.create()
        const definition = this.type.create({ term: previous.textContent.trim() }, content)
        const tr = state.tr.replaceWith(previousFrom, resolved.after(), definition)
        tr.setSelection(TextSelection.near(tr.doc.resolve(previousFrom + 2)))
      }
    })]
  },
  addNodeView() { return ReactNodeViewRenderer(DefinitionListNodeView) }
})

import { InputRule, Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { EditorState } from '@tiptap/pm/state'
import { HtmlBlockNodeView } from './HtmlBlockNodeView'
import { renderHtmlBlockPreview } from './preview'
import { HTML_BLOCK_TAGS, sanitizeHtmlBlock } from './sanitize'

function isInsideTable(state: EditorState, pos: number): boolean {
  const resolved = state.doc.resolve(pos)
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    const name = resolved.node(depth).type.name
    if (name === 'tableCell' || name === 'tableHeader') return true
  }
  return false
}

const BLOCK_PATTERN = new RegExp(`^(<(?:${HTML_BLOCK_TAGS.join('|')})\\b[\\s\\S]*?<\\/(?:${HTML_BLOCK_TAGS.join('|')})>\\s*(?:\\n|$)|<!--[\\s\\S]*?-->\\s*(?:\\n|$))`, 'i')

function tokenToJson(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('htmlBlock', { html: token.raw ?? '' })
}

export const HtmlBlock = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  isolating: true,
  addAttributes() { return { html: { default: '' }, htmlEditing: { default: false } } },
  parseHTML() { return [{ tag: 'div[data-html-block]' }] },
  renderHTML({ node }) { return ['div', { 'data-html-block': '', 'data-html': sanitizeHtmlBlock(String(node.attrs.html ?? '')) }] },
  addInputRules() {
    return [new InputRule({
      find: /^<$/,
      handler: ({ state, range }) => {
        if (isInsideTable(state, range.from)) return
        const node = this.type.create({ html: '<', htmlEditing: true })
        state.tr.replaceRangeWith(range.from, range.to, node)
      }
    })]
  },
  markdownTokenizer: {
    name: 'htmlBlock',
    level: 'block',
    start: (src: string): number => src.search(/^(?:<(?:article|aside|details|div|figure|form|section|table)\b|<!--)/im),
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(BLOCK_PATTERN)
      return match ? { type: 'htmlBlock', raw: match[1] } : undefined
    }
  },
  parseMarkdown: tokenToJson,
  renderMarkdown: (node: JSONContent): string => String(node.attrs?.html ?? '').trim(),
  addNodeView() { return ReactNodeViewRenderer(HtmlBlockNodeView) }
})

export { renderHtmlBlockPreview, sanitizeHtmlBlock }

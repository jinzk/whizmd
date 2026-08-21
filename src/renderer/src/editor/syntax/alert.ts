import { InputRule, Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MarkdownAlertNodeView } from '../MarkdownAlertNodeView'

const ALERT = /^>[ \t]*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n((?:>[ \t]?.*(?:\n|$))*)/i

function alertToken(token: MarkdownToken, _h: MarkdownParseHelpers): JSONContent {
  return {
    type: 'markdownAlert',
    attrs: { kind: String(token.kind ?? 'NOTE').toUpperCase() },
    content: [{ type: 'paragraph', content: [{ type: 'text', text: String(token.text ?? '').replace(/^>[ \t]?/gm, '').trim() }] }]
  }
}

export const MarkdownAlert = Node.create({
  name: 'markdownAlert', group: 'block', isolating: true, content: 'block+',
  addAttributes() { return { kind: { default: 'NOTE' } } },
  parseHTML() { return [{ tag: 'aside[data-markdown-alert]' }] },
  renderHTML({ node }) { return ['aside', { 'data-markdown-alert': node.attrs.kind }, 0] },
  markdownTokenizer: {
    name: 'markdownAlert', level: 'block', start: (src: string): number => src.indexOf('> [!'),
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(ALERT)
      return match ? { type: 'markdownAlert', raw: match[0], kind: match[1], text: match[2] } : undefined
    }
  },
  parseMarkdown: alertToken,
  renderMarkdown: (node: JSONContent): string => {
    const body = (node.content ?? []).map((child) => (child.content ?? []).map((inline) => String(inline.text ?? '')).join('')).join('\n')
      .split('\n').map((line) => `> ${line}`).join('\n')
    return `> [!${node.attrs?.kind ?? 'NOTE'}]\n${body}`
  },
  addInputRules() {
    return [new InputRule({
      find: /^(?:> )?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i,
      handler: ({ state, range, match }) => {
        const resolved = state.doc.resolve(range.from)
        if (resolved.parent.type.name !== 'paragraph') return
        const content = this.type.schema.nodes.paragraph.create()
        const alert = this.type.create({ kind: match[1].toUpperCase() }, content)
        const inBlockquote = resolved.node(-1)?.type.name === 'blockquote'
        const from = inBlockquote ? resolved.before(-1) : resolved.before()
        const to = inBlockquote ? resolved.after(-1) : resolved.after()
        const tr = state.tr.replaceWith(from, to, alert)
        tr.setSelection(TextSelection.near(tr.doc.resolve(from + 2)))
      }
    })]
  },
  addNodeView() { return ReactNodeViewRenderer(MarkdownAlertNodeView) }
})

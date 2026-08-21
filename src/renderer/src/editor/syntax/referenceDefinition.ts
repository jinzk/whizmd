import { InputRule, Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ReferenceDefinitionNodeView } from '../ReferenceDefinitionNodeView'

const REFERENCE_DEFINITION = /^\[(?!\^)([^\]\n]+)\]:[ \t]*(\S+)(?:[ \t]+["']([^"']*)["'])?(?:\n|$)/

export const ReferenceDefinition = Node.create({
  name: 'referenceDefinition', group: 'block', atom: true, isolating: true, selectable: true,
  addAttributes() { return { id: { default: '' }, destination: { default: '' }, title: { default: null } } },
  parseHTML() { return [{ tag: 'div[data-reference-definition]' }] },
  renderHTML({ node }) { return ['div', { 'data-reference-definition': node.attrs.id }] },
  markdownTokenizer: {
    name: 'referenceDefinition', level: 'block',
    start: (src: string): number => src.match(/\[(?!\^)[^\]\n]+\]:[ \t]/)?.index ?? -1,
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(REFERENCE_DEFINITION)
      return match ? { type: 'referenceDefinition', raw: match[0], id: match[1], href: match[2], title: match[3] } : undefined
    }
  },
  parseMarkdown: (token: MarkdownToken, h: MarkdownParseHelpers): JSONContent => h.createNode('referenceDefinition', {
    id: token.id ?? '', destination: token.href ?? '', title: token.title ?? null
  }),
  renderMarkdown: (node: JSONContent): string => {
    const title = node.attrs?.title ? ` "${node.attrs.title}"` : ''
    return `[${node.attrs?.id ?? ''}]: ${node.attrs?.destination ?? ''}${title}`
  },
  addInputRules() {
    return [new InputRule({
      find: /^\[([^\]\n]+)\]: $/,
      handler: ({ state, range, match }) => {
        const resolved = state.doc.resolve(range.from)
        if (resolved.parent.type.name !== 'paragraph' || resolved.depth !== 1) return
        const from = resolved.before()
        const node = this.type.create({ id: match[1] })
        const tr = state.tr.replaceWith(from, resolved.after(), node)
        tr.setSelection(NodeSelection.create(tr.doc, from))
      }
    })]
  },
  addNodeView() { return ReactNodeViewRenderer(ReferenceDefinitionNodeView) }
})

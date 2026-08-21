import { Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { InlineSyntaxNodeView } from '../inlineSyntax/InlineSyntaxNodeView'
import { createPairedTriggerExtension, createPairedTriggerInputRule } from '../input/pairedTrigger'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'

const INLINE_DECORATION = /^(==|\^|~)([^\n=^~]+?)\1/

function decorationToken(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('inlineDecoration', { kind: token.kind ?? 'highlight', value: token.text ?? '' })
}

export const InlineDecoration = Node.create({
  priority: 200,
  name: 'inlineDecoration', inline: true, group: 'inline', atom: true, selectable: true,
  addAttributes() { return { kind: { default: 'highlight' }, value: { default: '' } } },
  parseHTML() { return [{ tag: 'span[data-inline-decoration]' }] },
  renderHTML({ node }) {
    return ['span', { 'data-inline-decoration': node.attrs.kind, class: `inline-decoration-${node.attrs.kind}` }, node.attrs.value]
  },
  markdownTokenizer: {
    name: 'inlineDecoration', level: 'inline',
    start: (src: string): number => Math.min(...['==', '^', '~'].map((value) => {
      const index = src.indexOf(value)
      return index < 0 ? Number.MAX_SAFE_INTEGER : index
    })),
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(INLINE_DECORATION)
      if (!match) return undefined
      const kind = match[1] === '==' ? 'highlight' : match[1] === '^' ? 'superscript' : 'subscript'
      return { type: 'inlineDecoration', raw: match[0], kind, text: match[2] }
    }
  },
  parseMarkdown: decorationToken,
  renderMarkdown: (node: JSONContent): string => {
    const marker = node.attrs?.kind === 'highlight' ? '==' : node.attrs?.kind === 'superscript' ? '^' : '~'
    return `${marker}${node.attrs?.value ?? ''}${marker}`
  },
  addNodeView() { return ReactNodeViewRenderer(InlineSyntaxNodeView) },
  addInputRules() {
    return [createPairedTriggerInputRule([
      { marker: '==', priority: 70, accepts: (content) => content.length > 0 && !content.includes('\n') && !content.includes('='), createNode: (content) => this.type.create({ kind: 'highlight', value: content }) },
      { marker: '^', priority: 60, accepts: (content) => content.length > 0 && !content.includes('\n') && !content.includes('^'), createNode: (content) => this.type.create({ kind: 'superscript', value: content }) },
      { marker: '~', priority: 60, accepts: (content) => content.length > 0 && !content.includes('\n') && !content.includes('~'), createNode: (content) => this.type.create({ kind: 'subscript', value: content }) }
    ])]
  },
  addExtensions() {
    return [createPairedTriggerExtension([
      { marker: '==', priority: 70, accepts: (content) => content.length > 0 && !content.includes('\n') && !content.includes('='), createNode: (content, state) => state?.schema.nodes.inlineDecoration.create({ kind: 'highlight', value: content }) ?? null },
      { marker: '^', priority: 60, accepts: (content) => content.length > 0 && !content.includes('\n') && !content.includes('^'), createNode: (content, state) => state?.schema.nodes.inlineDecoration.create({ kind: 'superscript', value: content }) ?? null },
      { marker: '~', priority: 60, accepts: (content) => content.length > 0 && !content.includes('\n') && !content.includes('~'), createNode: (content, state) => state?.schema.nodes.inlineDecoration.create({ kind: 'subscript', value: content }) ?? null }
    ], 'inlineDecorationCompletion')]
  },
  addKeyboardShortcuts() {
    const type = this.type
    const moveAcross = (direction: 'left' | 'right') => ({ editor }: { editor: import('@tiptap/core').Editor }) => {
      const { selection } = editor.state
      if (selection instanceof NodeSelection && selection.node.type === type) {
        editor.commands.setTextSelection(direction === 'left' ? selection.from : selection.to)
        return true
      }
      if (!selection.empty || !(selection instanceof TextSelection)) return false
      const position = direction === 'left' ? selection.from - 1 : selection.from
      const node = editor.state.doc.nodeAt(position)
      if (!node || node.type !== type) return false
      editor.commands.setTextSelection(direction === 'left' ? position - node.nodeSize + 1 : position + node.nodeSize)
      return true
    }
    const remove = (direction: 'backward' | 'forward') => ({ editor }: { editor: import('@tiptap/core').Editor }) => {
      const { selection } = editor.state
      if (selection instanceof NodeSelection && selection.node.type === type) {
        editor.commands.deleteSelection()
        return true
      }
      if (!selection.empty) return false
      const position = direction === 'backward' ? selection.from - 1 : selection.from
      const node = editor.state.doc.nodeAt(position)
      if (!node || node.type !== type) return false
      const from = direction === 'backward' ? position - node.nodeSize + 1 : position
      editor.view.dispatch(editor.state.tr.delete(from, from + node.nodeSize))
      return true
    }
    return { ArrowLeft: moveAcross('left'), ArrowRight: moveAcross('right'), Backspace: remove('backward'), Delete: remove('forward') }
  }
})

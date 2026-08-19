import { InputRule, Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { InlineSyntaxNodeView } from './InlineSyntaxNodeView'

export type InlineSyntaxKind = 'italic' | 'bold' | 'boldItalic' | 'strike'

const DEFINITIONS: Record<InlineSyntaxKind, { marker: string; label: string }> = {
  boldItalic: { marker: '***', label: '粗斜体' },
  bold: { marker: '**', label: '粗体' },
  italic: { marker: '*', label: '斜体' },
  strike: { marker: '~~', label: '删除线' }
}

const KINDS = Object.keys(DEFINITIONS) as InlineSyntaxKind[]
const TOKEN_PATTERN = /^(\*\*\*|\*\*|\*|~~)([^\n]+?)\1(?!\1)/
const INPUT_PATTERN = /(^|[^\*~])(\*{1,3}|~~)(?!\*)([^\n]+?)\2(?!\*)$/

function kindFromMarker(marker: string): InlineSyntaxKind | undefined {
  return KINDS.find((kind) => DEFINITIONS[kind].marker === marker)
}

function parseToken(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  const raw = token.raw ?? ''
  const match = raw.match(TOKEN_PATTERN)
  const marker = match?.[1] ?? ''
  const kind = kindFromMarker(marker) ?? 'italic'
  return h.createNode('inlineSyntax', { kind, value: match?.[2] ?? token.text ?? '' })
}

function renderNode(node: JSONContent): string {
  const kind = node.attrs?.kind as InlineSyntaxKind
  const marker = DEFINITIONS[kind]?.marker ?? '*'
  return `${marker}${node.attrs?.value ?? ''}${marker}`
}

export const InlineSyntax = Node.create({
  name: 'inlineSyntax',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  addAttributes() {
    return { kind: { default: 'italic' }, value: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'span[data-inline-syntax]' }]
  },
  renderHTML({ node }) {
    return ['span', { 'data-inline-syntax': node.attrs.kind }]
  },
  markdownTokenizer: {
    name: 'inlineSyntax',
    level: 'inline',
    start: (src: string): number => {
      const match = src.match(/(?<![\*~])(\*{1,3}|~~)(?=\S)/)
      return match?.index ?? -1
    },
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(TOKEN_PATTERN)
      if (!match || !kindFromMarker(match[1])) return undefined
      return { type: 'inlineSyntax', raw: match[0], text: match[2] }
    }
  },
  parseMarkdown: parseToken,
  renderMarkdown: renderNode,
  addInputRules() {
    return [new InputRule({
      find: INPUT_PATTERN,
      handler: ({ state, range, match }) => {
        const kind = kindFromMarker(match[2])
        if (!kind || !match[3].trim()) return
        const node = this.type.create({ kind, value: match[3].trim() })
        const start = range.from + match[1].length
        const transaction = state.tr.replaceWith(start, range.to, node)
        transaction.setSelection(TextSelection.create(transaction.doc, start + node.nodeSize))
      }
    })]
  },
  addKeyboardShortcuts() {
    const type = this.type
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
    return { Backspace: remove('backward'), Delete: remove('forward') }
  },
  addNodeView() {
    return ReactNodeViewRenderer(InlineSyntaxNodeView)
  }
})

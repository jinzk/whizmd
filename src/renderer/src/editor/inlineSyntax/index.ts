import { Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { InlineSyntaxNodeView } from './InlineSyntaxNodeView'
import { createPairedTriggerExtension, createPairedTriggerInputRule } from '../input/pairedTrigger'
import { isInCodeBlock } from '../input/context'
import { inlineAtomKeyboardShortcuts } from '../nodeView/inlineAtomKeyboard'

export type InlineSyntaxKind = 'italic' | 'bold' | 'boldItalic' | 'strike'

const DEFINITIONS: Record<InlineSyntaxKind, { marker: string; label: string }> = {
  boldItalic: { marker: '***', label: '粗斜体' },
  bold: { marker: '**', label: '粗体' },
  italic: { marker: '*', label: '斜体' },
  strike: { marker: '~~', label: '删除线' }
}

const KINDS = Object.keys(DEFINITIONS) as InlineSyntaxKind[]
const TOKEN_PATTERN = /^(\*\*\*|\*\*|\*|~~)([^\n]+?)\1(?!\1)/

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
  priority: 200,
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
    return [createPairedTriggerInputRule([
      { marker: '***', priority: 100, accepts: (content) => content.trim().length > 0 && !content.includes('\n') && !content.includes('*'), createNode: (content, state) => state?.schema.nodes.inlineSyntax.create({ kind: 'boldItalic', value: content.trim() }) ?? null },
      { marker: '**', priority: 90, accepts: (content) => content.trim().length > 0 && !content.includes('\n') && !content.includes('*'), createNode: (content, state) => state?.schema.nodes.inlineSyntax.create({ kind: 'bold', value: content.trim() }) ?? null },
      { marker: '~~', priority: 80, accepts: (content) => content.trim().length > 0 && !content.includes('\n') && !content.includes('~'), createNode: (content, state) => state?.schema.nodes.inlineSyntax.create({ kind: 'strike', value: content.trim() }) ?? null },
      { marker: '*', priority: 70, accepts: (content) => content.trim().length > 0 && !content.includes('\n') && !content.includes('*'), createNode: (content, state) => state?.schema.nodes.inlineSyntax.create({ kind: 'italic', value: content.trim() }) ?? null }
    ])]
  },
  addExtensions() {
    return [createPairedTriggerExtension([
      { marker: '***', priority: 100, accepts: (content) => content.trim().length > 0 && !content.includes('\n') && !content.includes('*'), createNode: (content, state) => state?.schema.nodes.inlineSyntax.create({ kind: 'boldItalic', value: content.trim() }) ?? null },
      { marker: '**', priority: 90, accepts: (content) => content.trim().length > 0 && !content.includes('\n') && !content.includes('*'), createNode: (content, state) => state?.schema.nodes.inlineSyntax.create({ kind: 'bold', value: content.trim() }) ?? null },
      { marker: '~~', priority: 80, accepts: (content) => content.trim().length > 0 && !content.includes('\n') && !content.includes('~'), createNode: (content, state) => state?.schema.nodes.inlineSyntax.create({ kind: 'strike', value: content.trim() }) ?? null },
      { marker: '*', priority: 70, accepts: (content) => content.trim().length > 0 && !content.includes('\n') && !content.includes('*'), createNode: (content, state) => state?.schema.nodes.inlineSyntax.create({ kind: 'italic', value: content.trim() }) ?? null }
    ], 'inlineSyntaxCompletion')]
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction: (transactions, _oldState, state) => {
        if (!transactions.some((transaction) => transaction.docChanged)) return null

        const replacements: Array<{ from: number; to: number; node: ProseMirrorNode }> = []
        state.doc.descendants((textNode, position) => {
          if (!textNode.isText || !textNode.text || isInCodeBlock(state, position)) return
          const markNames = new Set(textNode.marks.map((mark) => mark.type.name))
          const markedKind = markNames.has('bold') && markNames.has('italic')
            ? 'boldItalic'
            : markNames.has('bold')
              ? 'bold'
              : markNames.has('italic')
                ? 'italic'
                : markNames.has('strike')
                  ? 'strike'
                  : undefined
          if (markedKind) {
            replacements.push({
              from: position,
              to: position + textNode.nodeSize,
              node: state.schema.nodes.inlineSyntax.create({ kind: markedKind, value: textNode.text })
            })
            return
          }
          for (const match of textNode.text.matchAll(/(\*{3}|\*{2}|\*|~~)([^\n]+?)\1(?!\1)/g)) {
            const marker = match[1]
            const value = match[2]
            const kind = kindFromMarker(marker)
            if (!kind || !value.trim() || value.includes(marker[0])) continue
            replacements.push({
              from: position + (match.index ?? 0),
              to: position + (match.index ?? 0) + match[0].length,
              node: state.schema.nodes.inlineSyntax.create({ kind, value: value.trim() })
            })
          }
        })

        if (!replacements.length) return null
        const transaction = state.tr
        for (const replacement of replacements.reverse()) {
          transaction.replaceWith(replacement.from, replacement.to, replacement.node)
        }
        return transaction.docChanged ? transaction : null
      }
    })]
  },
  addKeyboardShortcuts() {
    return inlineAtomKeyboardShortcuts(this.type)
  },
  addNodeView() {
    return ReactNodeViewRenderer(InlineSyntaxNodeView)
  }
})

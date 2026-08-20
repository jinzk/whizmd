import { Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'

const FOOTNOTE_REF = /^\[\^([^\]\n]+)\]/
const FOOTNOTE_DEF = /^\[\^([^\]\n]+)\]:[ \t]*(.*)(?:\n|$)/
const ALERT = /^>[ \t]*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n((?:>[ \t]?.*(?:\n|$))*)/i
const DEFINITION = /^([^\n]+)\n:[ \t]+([^\n]+)(?:\n|$)/
const INLINE_DECORATION = /^(==|\^|~)([^\n=^~]+?)\1/

function footnoteRefToken(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('footnoteReference', { id: token.id ?? token.text ?? '' })
}

function footnoteDefToken(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('footnoteDefinition', { id: token.id ?? '', content: token.text ?? '' })
}

function alertToken(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('markdownAlert', {
    kind: String(token.kind ?? 'NOTE').toUpperCase(),
    content: String(token.text ?? '').replace(/^>[ \t]?/gm, '').trim()
  })
}

function decorationToken(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('inlineDecoration', { kind: token.kind ?? 'highlight', value: token.text ?? '' })
}

function definitionToken(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('definitionListItem', { term: token.term ?? '', definition: token.text ?? '' })
}

export const FootnoteReference = Node.create({
  name: 'footnoteReference',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  addAttributes() {
    return { id: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'sup[data-footnote-reference]' }]
  },
  renderHTML({ node }) {
    return ['sup', { 'data-footnote-reference': node.attrs.id }, `[${node.attrs.id}]`]
  },
  markdownTokenizer: {
    name: 'footnoteReference',
    level: 'inline',
    start: (src: string): number => src.indexOf('[^'),
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(FOOTNOTE_REF)
      return match ? { type: 'footnoteReference', raw: match[0], id: match[1], text: match[1] } : undefined
    }
  },
  parseMarkdown: footnoteRefToken,
  renderMarkdown: (node: JSONContent): string => `[^${node.attrs?.id ?? ''}]`
})

export const FootnoteDefinition = Node.create({
  name: 'footnoteDefinition',
  group: 'block',
  atom: true,
  isolating: true,
  addAttributes() {
    return { id: { default: '' }, content: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-footnote-definition]' }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-footnote-definition': node.attrs.id }, node.attrs.content]
  },
  markdownTokenizer: {
    name: 'footnoteDefinition',
    level: 'block',
    start: (src: string): number => src.indexOf('[^'),
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(FOOTNOTE_DEF)
      return match ? { type: 'footnoteDefinition', raw: match[0], id: match[1], text: match[2] } : undefined
    }
  },
  parseMarkdown: footnoteDefToken,
  renderMarkdown: (node: JSONContent): string => `[^${node.attrs?.id ?? ''}]: ${node.attrs?.content ?? ''}`
})

export const MarkdownAlert = Node.create({
  name: 'markdownAlert',
  group: 'block',
  atom: true,
  isolating: true,
  addAttributes() {
    return { kind: { default: 'NOTE' }, content: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'aside[data-markdown-alert]' }]
  },
  renderHTML({ node }) {
    return ['aside', { 'data-markdown-alert': node.attrs.kind }, ['strong', node.attrs.kind], ['p', node.attrs.content]]
  },
  markdownTokenizer: {
    name: 'markdownAlert',
    level: 'block',
    start: (src: string): number => src.indexOf('> [!'),
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(ALERT)
      return match ? { type: 'markdownAlert', raw: match[0], kind: match[1], text: match[2] } : undefined
    }
  },
  parseMarkdown: alertToken,
  renderMarkdown: (node: JSONContent): string => {
    const body = String(node.attrs?.content ?? '').split('\n').map((line) => `> ${line}`).join('\n')
    return `> [!${node.attrs?.kind ?? 'NOTE'}]\n${body}`
  }
})

export const InlineDecoration = Node.create({
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
  }
})

export const DefinitionListItem = Node.create({
  name: 'definitionListItem', group: 'block', atom: true, isolating: true,
  addAttributes() { return { term: { default: '' }, definition: { default: '' } } },
  parseHTML() { return [{ tag: 'div[data-definition-list-item]' }] },
  renderHTML({ node }) {
    return ['div', { 'data-definition-list-item': '' }, ['dt', node.attrs.term], ['dd', node.attrs.definition]]
  },
  markdownTokenizer: {
    name: 'definitionListItem', level: 'block', start: (src: string): number => src.indexOf('\n:'),
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(DEFINITION)
      return match ? { type: 'definitionListItem', raw: match[0], term: match[1], text: match[2] } : undefined
    }
  },
  parseMarkdown: definitionToken,
  renderMarkdown: (node: JSONContent): string => `${node.attrs?.term ?? ''}\n: ${node.attrs?.definition ?? ''}`
})

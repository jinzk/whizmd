import { Image as BaseImage } from '@tiptap/extension-image'
import { InputRule } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { ImageNodeView } from './ImageNodeView'
import { canTriggerInlineMarkdown } from '../input/context'
import { encodeUrlValue } from '../../utils/url'

const IMAGE_PATTERN =
  /^!\[([^\]]*)\]\(([^\s)]+)(?:\s+("(?:[^"\\]|\\.)*"))?(?:\s+=\s*(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?)?)?)?\)/
const QUOTED_IMAGE_PATTERN = /^!\[([^\]]*)\]\("((?:[^"\\]|\\.)*)"(?:\s+("(?:[^"\\]|\\.)*"))?(?:\s+=\s*(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?)?)?)?\)/

function imageTokenToJson(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  const attrs: Record<string, unknown> = { src: token.src ?? '', reference: token.reference ?? null }
  if (token.alt) {
    attrs.alt = token.alt
  }
  if (token.title) {
    attrs.title = token.title
  }
  if (token.width) {
    attrs.width = token.width
  }
  return h.createNode('image', attrs)
}

/**
 * Image node with:
 * - a `width` attribute driven by drag-resize handles,
 * - a React node view that resolves local relative paths into `media://` URLs,
 * - a custom markdown spec supporting Typora's `![alt](src =WxH)` size syntax.
 */
export const Image = BaseImage.extend({
  inline() {
    return true
  },
  group() {
    return 'inline'
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width')
          if (!width) {
            return null
          }
          const parsed = parseFloat(width)
          return Number.isFinite(parsed) ? parsed : null
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {}
          }
          return { width: attributes.width }
        }
      },
      reference: { default: null },
      title: { default: null }
    }
  },
  markdownTokenizer: {
    name: 'image',
    level: 'inline',
    start(src: string): number {
      return src.indexOf('![')
    },
    tokenize(src: string): MarkdownToken | undefined {
      const match = src.match(IMAGE_PATTERN)
      const quotedMatch = src.match(QUOTED_IMAGE_PATTERN)
      if (quotedMatch && (!match || quotedMatch[0].length > match[0].length)) {
        const [, alt, rawSrc, title, width, height] = quotedMatch
        const token: MarkdownToken = { type: 'image', raw: quotedMatch[0], src: rawSrc, alt }
        if (title) token.title = title.slice(1, -1)
        if (width) { token.width = parseFloat(width); if (height) token.height = parseFloat(height) }
        return token
      }
      if (!match) {
        const reference = src.match(/^!\[([^\]]*)\]\[([^\]]+)\]/)
        return reference
          ? { type: 'image', raw: reference[0], src: reference[2], alt: reference[1], reference: reference[2] }
          : undefined
      }
      const [, alt, rawSrc, title, width, height] = match
      const token: MarkdownToken = {
        type: 'image',
        raw: match[0],
        src: rawSrc,
        alt
      }
      if (title) {
        token.title = title.slice(1, -1)
      }
      if (width) {
        token.width = parseFloat(width)
        if (height) {
          token.height = parseFloat(height)
        }
      }
      return token
    }
  },
  parseMarkdown: imageTokenToJson,
  renderMarkdown: (node: JSONContent): string => {
    const src = node.attrs?.src ?? ''
    const alt = node.attrs?.alt ?? ''
    const title = node.attrs?.title
    const width = node.attrs?.width
    let inner = encodeUrlValue(src)
    if (title) {
      inner += ` "${title}"`
    }
    if (width) {
      inner += ` =${width}`
    }
    return node.attrs?.reference ? `![${alt}][${node.attrs.reference}]` : `![${alt}](${inner})`
  },
  addInputRules() {
    return [
      new InputRule({
         find: /(?:^|.*)!\[([^\]\n]+)\]\[([^\]\n]+)\]$/,
         handler: ({ state, range, match }) => {
           if (!canTriggerInlineMarkdown(state, range.from)) return
           const start = range.from + match[0].indexOf('![')
           const before = state.doc.textBetween(Math.max(0, start - 1), start, '')
           if (before === '\\') return
          const node = this.type.create({ src: match[2], alt: match[1], reference: match[2] })
          const tr = state.tr.replaceWith(start, range.to, node)
          tr.setSelection(TextSelection.create(tr.doc, start + node.nodeSize))
        }
      }),
      new InputRule({
         find: /(?:^|.*)!\[([^\]\n]*)\]\($/,
         handler: ({ state, range, match }) => {
           if (!canTriggerInlineMarkdown(state, range.from)) return
           const start = range.from + match[0].indexOf('![')
           const before = state.doc.textBetween(Math.max(0, start - 1), start, '')
           if (before === '\\') return
          const transaction = state.tr.replaceRangeWith(
            start,
            range.to,
            this.type.create({ src: '', alt: match[1] })
          )
          const imagePosition = transaction.mapping.map(start)
          if (transaction.doc.nodeAt(imagePosition)) {
            transaction.setSelection(NodeSelection.create(transaction.doc, imagePosition))
          }
        }
      })
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  }
})

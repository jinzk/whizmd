import { Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

const BLOCK_TAGS = ['article', 'aside', 'details', 'div', 'figure', 'form', 'section', 'table']
const ALLOWED_TAGS = new Set([
  ...BLOCK_TAGS, 'caption', 'col', 'colgroup', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
  'a', 'b', 'br', 'code', 'del', 'em', 'i', 'img', 'li', 'mark', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup', 'u', 'ul'
])
const GLOBAL_ATTRIBUTES = new Set(['aria-label', 'class', 'id', 'role', 'style', 'title'])
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  col: new Set(['span', 'width']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['align', 'colspan', 'rowspan', 'valign', 'width']),
  th: new Set(['align', 'colspan', 'rowspan', 'scope', 'valign', 'width']),
  table: new Set(['border', 'cellpadding', 'cellspacing', 'width'])
}
const SAFE_STYLE_PROPERTIES = new Set(['background-color', 'color', 'font-size', 'font-style', 'font-weight', 'text-align', 'text-decoration', 'vertical-align', 'width'])

function isSafeUrl(value: string): boolean {
  return /^(?:https?:|mailto:|tel:|#|\/|data:image\/(?:gif|jpeg|png|webp);)/i.test(value.trim())
}

function sanitizeStyle(value: string): string {
  return value.split(';').map((declaration) => declaration.trim()).filter((declaration) => {
    const separator = declaration.indexOf(':')
    if (separator < 1) return false
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const cssValue = declaration.slice(separator + 1).trim()
    return SAFE_STYLE_PROPERTIES.has(property) && cssValue.length > 0 && !/url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:/i.test(cssValue)
  }).join('; ')
}

export function sanitizeHtmlBlock(source: string): string {
  const parsed = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html')
  const clean = (element: Element): void => {
    for (const child of Array.from(element.children)) {
      const tag = child.tagName.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) {
        child.replaceWith(...Array.from(child.childNodes))
        continue
      }
      for (const attribute of Array.from(child.attributes)) {
        const name = attribute.name.toLowerCase()
        const allowed = GLOBAL_ATTRIBUTES.has(name) || TAG_ATTRIBUTES[tag]?.has(name) === true
        if (!allowed || name.startsWith('on')) child.removeAttribute(attribute.name)
        else if (name === 'style') {
          const style = sanitizeStyle(attribute.value)
          style ? child.setAttribute('style', style) : child.removeAttribute(attribute.name)
        } else if ((name === 'href' || name === 'src') && !isSafeUrl(attribute.value)) {
          child.removeAttribute(attribute.name)
        }
      }
      if (tag === 'a') child.setAttribute('rel', 'noopener noreferrer nofollow')
      clean(child)
    }
  }
  clean(parsed.body)
  return parsed.body.innerHTML.trim()
}

const BLOCK_PATTERN = new RegExp(`^(<(?:${BLOCK_TAGS.join('|')})\\b[\\s\\S]*?<\\/(?:${BLOCK_TAGS.join('|')})>\\s*(?:\\n|$)|<!--[\\s\\S]*?-->\\s*(?:\\n|$))`, 'i')

function tokenToJson(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('htmlBlock', { html: token.raw ?? '' })
}

function HtmlBlockView({ node }: NodeViewProps): React.JSX.Element {
  return (
    <NodeViewWrapper className="html-block-node" contentEditable={false} data-html-block>
      <div className="html-block-label">HTML</div>
      <div className="html-block-preview" dangerouslySetInnerHTML={{ __html: sanitizeHtmlBlock(String(node.attrs.html ?? '')) }} />
    </NodeViewWrapper>
  )
}

export const HtmlBlock = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  isolating: true,
  addAttributes() { return { html: { default: '' } } },
  parseHTML() { return [{ tag: 'div[data-html-block]' }] },
  renderHTML({ node }) { return ['div', { 'data-html-block': '', 'data-html': sanitizeHtmlBlock(String(node.attrs.html ?? '')) }] },
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
  addNodeView() { return ReactNodeViewRenderer(HtmlBlockView) }
})

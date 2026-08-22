import { marked } from 'marked'
import { sanitizeHtmlBlock } from './sanitize'

const MARKDOWN_CONTAINER_TAGS = new Set(['article', 'aside', 'details', 'div', 'figure', 'section'])

export function renderHtmlBlockPreview(source: string): string {
  const parsed = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html')
  for (const element of Array.from(parsed.body.children)) {
    if (!MARKDOWN_CONTAINER_TAGS.has(element.tagName.toLowerCase())) continue
    element.innerHTML = marked.parse(element.innerHTML, { gfm: true, breaks: false }) as string
  }
  return sanitizeHtmlBlock(parsed.body.innerHTML)
}

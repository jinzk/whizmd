const BLOCK_TAGS = ['article', 'aside', 'details', 'div', 'figure', 'form', 'section', 'table']
const MARKDOWN_OUTPUT_TAGS = ['blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr']
const ALLOWED_TAGS = new Set([
  ...BLOCK_TAGS, ...MARKDOWN_OUTPUT_TAGS, 'caption', 'col', 'colgroup', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
  'a', 'b', 'br', 'code', 'del', 'em', 'i', 'img', 'li', 'mark', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup', 'u', 'ul'
])
const GLOBAL_ATTRIBUTES = new Set(['aria-label', 'class', 'id', 'role', 'style', 'title'])
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  col: new Set(['span', 'width']),
  div: new Set(['align']),
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
           if (style) child.setAttribute('style', style)
           else child.removeAttribute(attribute.name)
        } else if (name === 'align' && !/^(?:left|center|right|justify)$/i.test(attribute.value.trim())) child.removeAttribute(attribute.name)
        else if ((name === 'href' || name === 'src') && !isSafeUrl(attribute.value)) child.removeAttribute(attribute.name)
      }
      if (tag === 'a') child.setAttribute('rel', 'noopener noreferrer nofollow')
      clean(child)
    }
  }
  clean(parsed.body)
  return parsed.body.innerHTML.trim()
}

export const HTML_BLOCK_TAGS = BLOCK_TAGS

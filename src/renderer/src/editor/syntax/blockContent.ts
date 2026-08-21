import type { JSONContent } from '@tiptap/core'

export function renderInlineContent(content: JSONContent[] | undefined): string {
  return (content ?? []).map((node) => {
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'inlineDecoration') {
      const marker = node.attrs?.kind === 'highlight' ? '==' : node.attrs?.kind === 'superscript' ? '^' : '~'
      return `${marker}${node.attrs?.value ?? ''}${marker}`
    }
    if (node.type === 'footnoteReference') return `[^${node.attrs?.id ?? ''}]`
    if (node.type === 'inlineMath') return `$${node.attrs?.latex ?? ''}$`
    if (node.type === 'hardBreak') return '\\n'
    if (node.type === 'linkNode') {
      const text = node.attrs?.text ?? renderInlineContent(node.content)
      return node.attrs?.reference ? `[${text}][${node.attrs.reference}]` : `[${text}](${node.attrs?.href ?? ''})`
    }
    if (node.type === 'image') {
      const alt = node.attrs?.alt ?? ''
      return node.attrs?.reference ? `![${alt}][${node.attrs.reference}]` : `![${alt}](${node.attrs?.src ?? ''})`
    }
    return renderInlineContent(node.content)
  }).join('')
}

export function renderBlockContent(content: JSONContent[] | undefined): string {
  return (content ?? []).map((node) => {
    if (node.type === 'paragraph') return renderInlineContent(node.content)
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      return (node.content ?? []).map((item, index) => {
        const prefix = node.type === 'bulletList' ? '- ' : `${index + 1}. `
        return `${prefix}${renderBlockContent(item.content).replace(/\n/g, '\n  ')}`
      }).join('\n')
    }
    if (node.type === 'listItem') return renderBlockContent(node.content)
    if (node.type === 'codeBlock') return `\`\`\`${node.attrs?.language ? node.attrs.language : ''}\n${renderInlineContent(node.content)}\n\`\`\``
    if (node.type === 'blockquote') return renderBlockContent(node.content).split('\n').map((line) => `> ${line}`).join('\n')
    if (node.type === 'horizontalRule') return '---'
    return renderBlockContent(node.content)
  }).join('\n\n')
}

export function collectIndentedBody(src: string, firstLength: number, indentation: number): { raw: string; body: string } {
  const lines = src.slice(firstLength).split(/(?<=\n)/)
  const body: string[] = []
  let consumed = firstLength
  for (const line of lines) {
    const value = line.replace(/\n$/, '')
    if (value.trim() === '') {
      body.push('')
      consumed += line.length
      continue
    }
    if (!new RegExp(`^ {${indentation}}`).test(value)) break
    body.push(value.slice(indentation))
    consumed += line.length
  }
  let inFence = false
  const normalized = body.join('\n').split('\n').map((line) => {
    if (/^ {4}```/.test(line)) {
      inFence = !inFence
      return line.slice(4)
    }
    return inFence && /^ {4}/.test(line) ? line.slice(4) : line
  }).join('\n')
  return { raw: src.slice(0, consumed), body: normalized }
}

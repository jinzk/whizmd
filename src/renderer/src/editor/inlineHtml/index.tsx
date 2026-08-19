import { InputRule, Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { NodeSelection, TextSelection, Plugin } from '@tiptap/pm/state'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

const ALLOWED_TAGS = new Set(['a', 'b', 'br', 'del', 'em', 'i', 'img', 'mark', 's', 'span', 'strong', 'sub', 'sup', 'u'])
const GLOBAL_ATTRIBUTES = new Set(['class', 'id', 'style', 'title'])
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height'])
}
const SAFE_STYLE_PROPERTIES = new Set(['background-color', 'color', 'font-size', 'font-style', 'font-weight', 'text-decoration', 'vertical-align'])

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

export function sanitizeInlineHtml(source: string): string {
  const document = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html')
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
          style ? child.setAttribute('style', style) : child.removeAttribute('style')
        } else if ((name === 'href' || name === 'src') && !isSafeUrl(attribute.value)) child.removeAttribute(attribute.name)
      }
      if (tag === 'a') child.setAttribute('rel', 'noopener noreferrer nofollow')
      clean(child)
    }
  }
  clean(document.body)
  return document.body.innerHTML
}

const HTML_PATTERN = /^<(?:a|b|br|del|em|i|img|mark|s|span|strong|sub|sup|u)\b[^>]*(?:\/>|>[^\n<]*(?:<\/(?:a|b|del|em|i|mark|s|span|strong|sub|sup|u)>)?)/i
const HTML_INPUT_PATTERN = /<(a|b|br|del|em|i|img|mark|s|span|strong|sub|sup|u)\b[^>]*(?:\/>|>[^\n<]*<\/\1>)$/i
const HTML_SCAN_PATTERN = /<(a|b|del|em|i|mark|s|span|strong|sub|sup|u)\b[^>]*>[^\n<]*<\/\1>|<(br|img)\b[^>]*\/>/gi

function isInsideCodeBlock(state: any, position: number): boolean {
  const resolved = state.doc.resolve(position)
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    if (resolved.node(depth).type.name === 'codeBlock') return true
  }
  return false
}

function tokenToJson(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('inlineHtml', { html: token.raw ?? '' })
}

function InlineHtmlView({ node, updateAttributes, deleteNode }: NodeViewProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(node.attrs.html ?? ''))
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (!editing) setValue(String(node.attrs.html ?? '')) }, [editing, node.attrs.html])
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select() } }, [editing])

  const commit = (): void => {
    const next = value.trim()
    if (!next) deleteNode()
    else { updateAttributes({ html: next }); setEditing(false) }
  }
  const cancel = (): void => { setValue(String(node.attrs.html ?? '')); setEditing(false) }

  return (
    <NodeViewWrapper as="span" className="inline-html-node" data-editing={editing ? 'true' : 'false'}>
      {editing ? (
        <span className="inline-syntax-edit-controls">
          <span className="inline-syntax-label">HTML</span>
          <input ref={inputRef} className="inline-syntax-input" value={value} aria-label="编辑 HTML 标签" onChange={(event) => setValue(event.target.value)} onBlur={commit} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.key === 'Escape' ? cancel() : commit() } }} />
          <button type="button" className="inline-syntax-delete" aria-label="删除 HTML 标签" onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>删除</button>
        </span>
      ) : (
        <button type="button" className="inline-html-preview" aria-label="编辑 HTML 标签" onMouseDown={(event) => event.preventDefault()} onClick={() => setEditing(true)} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(String(node.attrs.html ?? '')) }} />
      )}
    </NodeViewWrapper>
  )
}

export const InlineHtml = Node.create({
  name: 'inlineHtml', inline: true, group: 'inline', atom: true, selectable: true,
  addAttributes() { return { html: { default: '' } } },
  parseHTML() { return [{ tag: 'span[data-inline-html]' }] },
  renderHTML({ node }) { return ['span', { 'data-inline-html': '', 'data-html': sanitizeInlineHtml(node.attrs.html) }] },
  markdownTokenizer: {
    name: 'inlineHtml', level: 'inline', start: (src: string): number => src.indexOf('<'),
    tokenize(src: string): MarkdownToken | undefined { const match = src.match(HTML_PATTERN); return match ? { type: 'inlineHtml', raw: match[0] } : undefined }
  },
  parseMarkdown: tokenToJson,
  renderMarkdown: (node: JSONContent): string => sanitizeInlineHtml(String(node.attrs?.html ?? '')),
  addInputRules() { return [new InputRule({ find: HTML_INPUT_PATTERN, handler: ({ state, range, match }) => { if (isInsideCodeBlock(state, range.from)) return; const clean = sanitizeInlineHtml(match[0]); if (!clean) return; const node = this.type.create({ html: match[0] }); const tr = state.tr.replaceRangeWith(range.from, range.to, node); tr.setSelection(TextSelection.create(tr.doc, range.from + node.nodeSize)) } })] },
  addProseMirrorPlugins() { return [new Plugin({ appendTransaction: (_transactions, _oldState, state) => { const matches: Array<{ from: number; to: number; html: string }> = []; state.doc.descendants((node, position) => { if (!node.isText || !node.text || isInsideCodeBlock(state, position)) return; for (const match of node.text.matchAll(HTML_SCAN_PATTERN)) { if (match.index !== undefined) matches.push({ from: position + match.index, to: position + match.index + match[0].length, html: match[0] }) } }); if (!matches.length) return null; const tr = state.tr; for (const match of matches.reverse()) tr.replaceWith(match.from, match.to, this.type.create({ html: match.html })); return tr } })] },
  addKeyboardShortcuts() { const type = this.type; const remove = (direction: 'backward' | 'forward') => ({ editor }: { editor: import('@tiptap/core').Editor }) => { const { selection } = editor.state; if (selection instanceof NodeSelection && selection.node.type === type) { editor.commands.deleteSelection(); return true } if (!selection.empty) return false; const position = direction === 'backward' ? selection.from - 1 : selection.from; const node = editor.state.doc.nodeAt(position); if (!node || node.type !== type) return false; const from = direction === 'backward' ? position - node.nodeSize + 1 : position; editor.view.dispatch(editor.state.tr.delete(from, from + node.nodeSize)); return true }; return { Backspace: remove('backward'), Delete: remove('forward') } },
  addNodeView() { return ReactNodeViewRenderer(InlineHtmlView) }
})

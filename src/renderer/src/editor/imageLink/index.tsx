import { InputRule, Node } from '@tiptap/core'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { useEffect, useRef, useState } from 'react'
import { useDocumentStore } from '../../store/documents'
import { dirnamePath, isAbsolutePath, mediaUrlToPath, resolveRelative } from '../../utils/path'
import { useNodeViewField } from '../nodeView/useNodeViewField'
import { useI18n } from '../../i18n'
import { decodeUrlPath, encodeUrlValue } from '../../utils/url'

const IMAGE_LINK_PATTERN = /^\[!\[([^\]]*)\]\((?:"((?:[^"\\]|\\.)*)"|([^\s)]+))(?:\s+("(?:[^"\\]|\\.)*"))?\)\]\(([^)]+)\)/

function resolveSrc(src: string, docPath: string | null, rootDir: string | null): string {
  const value = decodeUrlPath(src.trim())
  if (!value) return ''
  if (/^(https?:|data:|blob:)/i.test(value)) return value
  if (/^media:/i.test(value)) return window.markdownApp.mediaUrl(mediaUrlToPath(value))
  const absolute = value.startsWith('/') && rootDir
    ? resolveRelative(rootDir, value)
    : isAbsolutePath(value)
      ? value
      : docPath
        ? resolveRelative(dirnamePath(docPath), value)
        : ''
  return absolute ? window.markdownApp.mediaUrl(absolute) : ''
}

function tokenToJson(token: MarkdownToken, h: MarkdownParseHelpers): JSONContent {
  return h.createNode('imageLinkNode', {
    src: token.src ?? '', alt: token.alt ?? '', title: token.title ?? null,
    href: token.href ?? '', reference: token.reference ?? null
  })
}

export function ImageLinkView({ node, updateAttributes, deleteNode, selected, editor, getPos }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const rootDir = useDocumentStore((state) => state.rootDir)
  const docPath = useDocumentStore((state) => state.documents.find((doc) => doc.id === state.activeDocumentId)?.path ?? null)
  const [showEdit, setShowEdit] = useState(false)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  const blurTimer = useRef<number | null>(null)
  const editorRef = useRef<HTMLSpanElement>(null)
  const srcField = useNodeViewField(String(node.attrs.src ?? ''), (value) => updateAttributes({ src: encodeUrlValue(value) }), { commitOnChange: false })
  const altField = useNodeViewField(String(node.attrs.alt ?? ''), (value) => updateAttributes({ alt: value }), { commitOnChange: false })
  const titleField = useNodeViewField(String(node.attrs.title ?? ''), (value) => updateAttributes({ title: value || null }), { commitOnChange: false })
  const hrefField = useNodeViewField(String(node.attrs.href ?? ''), (value) => updateAttributes({ href: encodeUrlValue(value) }), { commitOnChange: false })
  const [editing, setEditing] = useState(selected || !srcField.value)
  const resolvedSrc = resolveSrc(srcField.value, docPath, rootDir)
  const imageSrc = resolvedSrc && failedSrc !== resolvedSrc ? resolvedSrc : ''
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
  }, [])
  useEffect(() => {
    if (!editing) return
    const updateEditing = (): void => {
      const position = getPos()
      if (position === undefined) return
      const selection = editor.state.selection
      const inside = selection.from > position && selection.from < position + node.nodeSize
      if (!inside) setEditing(false)
    }
    editor.on('selectionUpdate', updateEditing)
    return () => { editor.off('selectionUpdate', updateEditing) }
  }, [editing, editor, getPos, node.nodeSize])
  const show = (): void => { if (timer.current !== null) window.clearTimeout(timer.current); setShowEdit(true) }
  const hide = (): void => { if (timer.current !== null) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setShowEdit(false), 350) }

  return <NodeViewWrapper as="span" className="image-link-node" data-selected={selected ? 'true' : 'false'} data-image-link-editing={editing ? 'true' : 'false'}>
    {editing ? <span className="image-link-editor" onKeyDown={(event) => event.stopPropagation()} onFocusCapture={() => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
    }} onBlur={(event) => {
      if (event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) return
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
      blurTimer.current = window.setTimeout(() => {
        if (!editorRef.current?.contains(document.activeElement)) setEditing(false)
      }, 0)
    }} ref={editorRef}>
      <span className="image-link-preview">{imageSrc ? <img src={imageSrc} alt={altField.value} title={titleField.value || undefined} onError={() => setFailedSrc(imageSrc)} /> : <span>{resolvedSrc ? t('imageLoadFailed', { src: srcField.value }) : t('enterImageAddress')}</span>}</span>
      <span className="image-link-fields">
        <span className="image-field"><span>{t('imageAlt')}</span><input value={altField.value} aria-label={t('imageAlt')} placeholder={t('enterImageAlt')} onChange={(event) => altField.change(event.target.value)} onBlur={altField.commit} onKeyDown={altField.onKeyDown} /><button type="button" className="block-module-delete image-delete" aria-label={t('deleteImage')} title={t('deleteImage')} onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>{t('delete')}</button></span>
        <label className="image-field"><span>{t('imageSrc')}</span><input value={srcField.value} aria-label={t('imageSrc')} placeholder={t('enterImageAddress')} onChange={(event) => srcField.change(event.target.value)} onBlur={srcField.commit} onKeyDown={srcField.onKeyDown} /></label>
        <label className="image-field"><span>{t('imageTitle')}</span><input value={titleField.value} aria-label={t('imageTitle')} placeholder={t('enterImageTitle')} onChange={(event) => titleField.change(event.target.value)} onBlur={titleField.commit} onKeyDown={titleField.onKeyDown} /></label>
        <label className="image-field"><span>{t('linkAddress')}</span><input value={hrefField.value} aria-label={t('linkAddress')} placeholder="https://example.com" onChange={(event) => hrefField.change(event.target.value)} onBlur={hrefField.commit} onKeyDown={hrefField.onKeyDown} /></label>
      </span>
    </span> : <span className="image-link-preview-wrap image-preview" onMouseEnter={show} onMouseLeave={hide}>
      <a className="image-link-anchor" href={hrefField.value || undefined} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        {imageSrc ? <img src={imageSrc} alt={altField.value} title={titleField.value || undefined} onError={() => setFailedSrc(imageSrc)} /> : <span className={resolvedSrc ? 'image-broken' : 'image-placeholder'}>{resolvedSrc ? t('imageLoadFailed', { src: srcField.value }) : t('enterImageAddress')}</span>}
        <span className="image-link-arrow" aria-hidden="true">↗</span>
      </a>
      <button type="button" className={`image-edit-button image-link-edit-button ${showEdit ? 'visible' : ''}`} aria-label={t('editImageLink')} onMouseEnter={show} onMouseLeave={hide} onMouseDown={(event) => event.preventDefault()} onClick={() => setEditing(true)}>{t('edit')}</button>
    </span>}
  </NodeViewWrapper>
}

export const ImageLinkNode = Node.create({
  priority: 1100,
  name: 'imageLinkNode', inline: true, group: 'inline', atom: true, selectable: true,
  addAttributes() { return { src: { default: '' }, alt: { default: '' }, title: { default: null }, href: { default: '' }, reference: { default: null } } },
  parseHTML() { return [{ tag: 'span[data-image-link-node]' }] },
  renderHTML({ node }) { return ['span', { 'data-image-link-node': '' }, ['a', { href: node.attrs.href }, ['img', { src: node.attrs.src, alt: node.attrs.alt, title: node.attrs.title }]]] },
  markdownTokenizer: { name: 'imageLinkNode', level: 'inline', start: (src: string) => src.indexOf('[!['), tokenize(src: string): MarkdownToken | undefined { const match = src.match(IMAGE_LINK_PATTERN); return match ? { type: 'imageLinkNode', raw: match[0], alt: match[1], src: match[2] ?? match[3], title: match[4]?.slice(1, -1), href: match[5] } : undefined } },
  parseMarkdown: tokenToJson,
  renderMarkdown: (node: JSONContent): string => {
    const title = node.attrs?.title ? ` "${node.attrs.title}"` : ''
    const src = String(node.attrs?.src ?? '')
    const imageSrc = encodeUrlValue(src)
    const image = `![${node.attrs?.alt ?? ''}](${imageSrc}${title})`
    return `[${image}](${node.attrs?.href ?? ''})`
  },
  addInputRules() {
    return [new InputRule({
      find: /(?:^|.*)\[!\[([^\]\n]*)\]\($/,
      handler: ({ state, range, match }) => {
        const start = range.from + match[0].indexOf('[![')
        const before = state.doc.textBetween(Math.max(0, start - 1), start, '')
        if (before === '\\') return
        const transaction = state.tr.replaceRangeWith(
          start,
          range.to,
          this.type.create({ src: '', alt: match[1], title: null, href: '' })
        )
        const imageLinkPosition = transaction.mapping.map(start)
        if (transaction.doc.nodeAt(imageLinkPosition)) {
          transaction.setSelection(NodeSelection.create(transaction.doc, imageLinkPosition))
        }
      }
    })]
  },
  addNodeView() { return ReactNodeViewRenderer(ImageLinkView) }
})

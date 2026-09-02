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
import { useNodeViewEditing } from '../nodeView/useNodeViewEditing'
import { useNodeViewHover } from '../nodeView/useNodeViewHover'
import { MediaPreview } from '../media/MediaPreview'
import { MediaFields } from '../media/MediaFields'
import { MediaEditorPortal } from '../nodeView/MediaEditorPortal'

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
  const { visible: showEdit, show, hide } = useNodeViewHover()
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const blurTimer = useRef<number | null>(null)
  const editorRef = useRef<HTMLSpanElement>(null)
  const srcField = useNodeViewField(String(node.attrs.src ?? ''), (value) => updateAttributes({ src: encodeUrlValue(value) }), { commitOnChange: false })
  const altField = useNodeViewField(String(node.attrs.alt ?? ''), (value) => updateAttributes({ alt: value }), { commitOnChange: false })
  const titleField = useNodeViewField(String(node.attrs.title ?? ''), (value) => updateAttributes({ title: value || null }), { commitOnChange: false })
  const hrefField = useNodeViewField(String(node.attrs.href ?? ''), (value) => updateAttributes({ href: encodeUrlValue(value) }), { commitOnChange: false })
  const { editing, setEditing } = useNodeViewEditing(editor, getPos, node.nodeSize, selected || !srcField.value)
  const resolvedSrc = resolveSrc(srcField.value, docPath, rootDir)
  const shownSrc = resolvedSrc && failedSrc !== resolvedSrc ? resolvedSrc : ''
  const imageSrc = shownSrc
  const pickImage = async (): Promise<void> => {
    const sourcePath = await window.markdownApp.file.pickImage()
    if (!sourcePath) return
    const result = await window.markdownApp.file.importImage(sourcePath, docPath)
    srcField.change(docPath ? result.markdownPath : window.markdownApp.mediaUrl(result.absolutePath))
  }
  useEffect(() => () => { if (blurTimer.current !== null) window.clearTimeout(blurTimer.current) }, [])

  return <NodeViewWrapper as="span" className="image-link-node" data-selected={selected ? 'true' : 'false'} data-image-link-editing={editing ? 'true' : 'false'}>
    {editing ? <MediaEditorPortal editor={editor} getPos={getPos} className="media-editor-portal" onClose={() => setEditing(false)}><span className="image-link-editor" onKeyDown={(event) => event.stopPropagation()} onFocusCapture={() => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
    }} onBlur={(event) => {
      if (event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) return
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
      blurTimer.current = window.setTimeout(() => {
        if (!editorRef.current?.contains(document.activeElement)) setEditing(false)
      }, 0)
    }} ref={editorRef}>
      <span className="image-link-preview"><MediaPreview src={imageSrc} alt={altField.value} title={titleField.value} failed={!imageSrc && Boolean(resolvedSrc)} failedLabel={t('imageLoadFailed', { src: srcField.value })} emptyLabel={t('enterImageAddress')} onError={() => setFailedSrc(imageSrc)} /></span>
       <MediaFields alt={altField} src={srcField} title={titleField} href={hrefField} onDelete={deleteNode} onPickImage={() => void pickImage()} />
    </span></MediaEditorPortal> : <span className="image-link-preview-wrap image-preview" onMouseEnter={show} onMouseLeave={hide}>
      <a className="image-link-anchor" href={hrefField.value || undefined} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        <MediaPreview src={imageSrc} alt={altField.value} title={titleField.value} failed={!imageSrc && Boolean(resolvedSrc)} failedLabel={t('imageLoadFailed', { src: srcField.value })} emptyLabel={t('enterImageAddress')} onError={() => setFailedSrc(imageSrc)} />
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
       find: /(?<!\\)\[!\[([^\]\n]*)\]\($/,
      handler: ({ state, range, match }) => {
         const start = range.from
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

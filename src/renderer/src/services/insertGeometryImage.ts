import type { Editor } from '@tiptap/core'
import { addPendingGeometryAsset } from './pendingGeometryAssets'
import { bumpMediaVersion } from './mediaRefresh'

export type InsertGeometryImageArgs = {
  svg: string
  docPath: string | null
  existingPath?: string
  existingPosition?: number
  existingEditor?: Editor | null
  editor: Editor | null
  activeDocumentId: string
  hasActiveDocument: boolean
  onStagedNotice: () => void
  appendMarkdown: (markdown: string) => void
}

/**
 * Persists a geometry SVG beside the document (or into the app asset library
 * for untitled documents) and inserts the corresponding image node. Untitled
 * documents reference the asset through the media:// protocol so the markdown
 * stays portable; the pending queue rewrites the reference at first save.
 */
export async function insertGeometryImage(args: InsertGeometryImageArgs): Promise<string> {
  const { svg, docPath, existingPath, existingPosition, existingEditor, editor, activeDocumentId, hasActiveDocument, onStagedNotice, appendMarkdown } = args
  const result = await window.markdownApp.file.saveGeometry(svg, `geometry-${Date.now()}.svg`, docPath, existingPath)
  const storedSrc = docPath ? result.markdownPath : window.markdownApp.mediaUrl(result.absolutePath)
  if (!docPath && hasActiveDocument) {
    addPendingGeometryAsset(activeDocumentId, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, svg, previousRef: storedSrc })
    onStagedNotice()
  }
  const activeEditor = existingEditor ?? editor
  if (activeEditor && !activeEditor.isDestroyed) {
    const replaced = existingPath
      ? replaceExistingNode(activeEditor, existingPath, storedSrc, existingPosition)
      : false
    if (!replaced) {
      if (existingPath) throw new Error('无法定位正在编辑的几何图片，未插入新图片')
      activeEditor.chain().focus().setImage({ src: storedSrc, alt: '几何图' }).run()
    }
  } else if (existingPath) {
    throw new Error('编辑器不可用，未插入新图片')
  } else {
    const image = `![几何图](${storedSrc})`
    appendMarkdown(image)
  }
  bumpMediaVersion(storedSrc)
  return storedSrc
}

function replaceExistingNode(editor: Editor, src: string, storedSrc: string, position?: number): boolean {
  let match: { from: number; to: number } | null = null
  if (typeof position === 'number') {
    const node = editor.state.doc.nodeAt(position)
    if (node && (node.type.name === 'image' || node.type.name === 'imageLinkNode') && node.attrs.src === src) {
      match = { from: position, to: position + node.nodeSize }
    }
  }
  editor.state.doc.descendants((node, pos) => {
    if (match) return false
    if ((node.type.name === 'image' || node.type.name === 'imageLinkNode') && node.attrs.src === src) {
      match = { from: pos, to: pos + node.nodeSize }
      return false
    }
    return true
  })
  if (!match) return false
  editor.chain().command(({ tr }) => {
    const current = tr.doc.nodeAt(match!.from)
    if (!current) return false
    tr.replaceWith(match!.from, match!.to, current.type.create({ ...current.attrs, src: storedSrc }))
    return true
  }).focus().run()
  return true
}

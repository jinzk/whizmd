import type { Editor } from '@tiptap/core'
import { addPendingGeometryAsset } from './pendingGeometryAssets'

export type InsertGeometryImageArgs = {
  svg: string
  docPath: string | null
  existingPath?: string
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
  const { svg, docPath, existingPath, editor, activeDocumentId, hasActiveDocument, onStagedNotice, appendMarkdown } = args
  const result = await window.markdownApp.file.saveGeometry(svg, `geometry-${Date.now()}.svg`, docPath, existingPath)
  const storedSrc = docPath ? result.markdownPath : window.markdownApp.mediaUrl(result.absolutePath)
  if (!docPath && hasActiveDocument) {
    addPendingGeometryAsset(activeDocumentId, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, svg, previousRef: storedSrc })
    onStagedNotice()
  }
  if (editor && !editor.isDestroyed) {
    editor.chain().focus().setImage({ src: storedSrc, alt: '几何图' }).run()
  } else {
    const image = `![几何图](${storedSrc})`
    appendMarkdown(image)
  }
  return storedSrc
}

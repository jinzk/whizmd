import type { Editor } from '@tiptap/core'
import { useDocumentStore } from '../../store/documents'

const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|svg|webp|bmp|ico|avif)$/i

export function isImageFile(file: File | { name: string }): boolean {
  return file.name ? IMAGE_EXTENSION_RE.test(file.name) : false
}

function insertImage(editor: Editor, src: string, alt: string): void {
  editor.chain().focus().setImage({ src, alt }).run()
}

type ImageResult = { markdownPath: string; absolutePath: string }

/** Resolve the stored src: relative path for saved docs, media:// URL for
 *  untitled docs (images live in the app asset library). */
function resolveStoredSrc(result: ImageResult, docPath: string | null): string {
  return docPath ? result.markdownPath : window.markdownApp.mediaUrl(result.absolutePath)
}

/** Pick an image via the OS dialog, import it into assets, and insert. */
export async function insertImageFromDialog(editor: Editor): Promise<void> {
  const sourcePath = await window.markdownApp.file.pickImage()
  if (!sourcePath) {
    return
  }
  const docPath = useDocumentStore.getState().documents.find(
    (document) => document.id === useDocumentStore.getState().activeDocumentId
  )?.path ?? null
  try {
    const result = await window.markdownApp.file.importImage(sourcePath, docPath)
    insertImage(editor, resolveStoredSrc(result, docPath), '')
  } catch (err) {
    console.error('Failed to import image', err)
  }
}

/** Import a list of dropped image files into assets and insert them. */
export async function insertDroppedImages(editor: Editor, files: File[]): Promise<void> {
  const state = useDocumentStore.getState()
  const docPath = state.documents.find((document) => document.id === state.activeDocumentId)?.path ?? null
  for (const file of files) {
    try {
      let result: ImageResult
      if (docPath) {
        const filePath = window.markdownApp.getPathForFile(file)
        if (filePath) {
          result = await window.markdownApp.file.importImage(filePath, docPath)
        } else {
          // Blob-backed file (no on-disk path): save it directly.
          const buf = await file.arrayBuffer()
          result = await window.markdownApp.file.saveImageBlob(
            { data: new Uint8Array(buf), name: file.name },
            docPath
          )
        }
      } else {
        // Untitled doc: persist to the app asset library instead of base64.
        const buf = await file.arrayBuffer()
        result = await window.markdownApp.file.saveImageBlob(
          { data: new Uint8Array(buf), name: file.name },
          null
        )
      }
      insertImage(editor, resolveStoredSrc(result, docPath), file.name)
    } catch (err) {
      console.error('Failed to insert dropped image', err)
    }
  }
}

/** Save pasted clipboard images (screenshots etc.) and insert them. */
export async function insertPastedImages(editor: Editor, items: DataTransferItem[]): Promise<void> {
  const files: File[] = []
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        files.push(file)
      }
    }
  }
  if (files.length > 0) {
    await insertDroppedImages(editor, files)
  }
}

import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import { WysiwygEditor } from '../../components/WysiwygEditor'
import { insertGeometryImage } from '../insertGeometryImage'
import type { MarkdownAppApi } from '../../../../shared/types'

const ASSET_PATH = 'C:\\Users\\alex\\AppData\\Roaming\\whizmd\\assets\\geometry-1.svg'
const MEDIA_SRC = 'media:///C:/Users/alex/AppData/Roaming/whizmd/assets/geometry-1.svg'

function setupApi(): void {
  const api = {
    config: { get: vi.fn(), set: vi.fn(), onChanged: vi.fn(() => vi.fn()) },
    help: { open: vi.fn(async () => null) },
    window: {
      setTitle: vi.fn(),
      setDirty: vi.fn(),
      setLanguage: vi.fn(),
      onMenuCommand: vi.fn(() => vi.fn()),
      onRecentMenuTarget: vi.fn(() => vi.fn())
    },
    file: {
      openDialog: vi.fn(async () => null),
      pickImage: vi.fn(async () => null),
      openDirectoryDialog: vi.fn(async () => null),
      saveFileDialog: vi.fn(async () => null),
      read: vi.fn(async () => ''),
      write: vi.fn(async () => ''),
      importImage: vi.fn(),
      saveImageBlob: vi.fn(),
      saveGeometry: vi.fn(async () => ({ markdownPath: ASSET_PATH, absolutePath: ASSET_PATH })),
      prepareImages: vi.fn(async (content: string) => content)
    },
    dir: { scan: vi.fn(async () => ({ status: 'empty' as const, tree: null })), cancelScan: vi.fn() },
    exportHtml: vi.fn(),
    exportPdf: vi.fn(),
    getPathForFile: vi.fn(),
    // Mirrors the real preload implementation exactly (slash only when missing).
    mediaUrl: (absolutePath: string): string => {
      const normalized = absolutePath.split('\\').join('/')
      const encoded = encodeURIComponent(normalized).replace(/%2F/gi, '/').replace(/%3A/gi, ':')
      return `media://${encoded.startsWith('/') ? '' : '/'}${encoded}`
    },
    recent: undefined
  }
  window.markdownApp = api as unknown as MarkdownAppApi
}

async function mountEditor(onUpdate: (markdown: string) => void): Promise<Editor> {
  let editor: Editor | null = null
  render(<WysiwygEditor content="" onUpdate={onUpdate} onEditorReady={(instance) => { editor = instance }} />)
  await waitFor(() => expect(editor).not.toBeNull())
  return editor as unknown as Editor
}

describe('insertGeometryImage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the inserted image node with a media:// source in a live editor', async () => {
    setupApi()
    const editor = await mountEditor(vi.fn())

    let storedSrc = ''
    await act(async () => {
      storedSrc = await insertGeometryImage({
        svg: '<svg/>',
        docPath: null,
        editor,
        activeDocumentId: 'doc-1',
        hasActiveDocument: true,
        onStagedNotice: () => undefined,
        appendMarkdown: vi.fn()
      })
    })

    expect(storedSrc).toBe(MEDIA_SRC)
    expect(editor.getMarkdown()).toContain(`](media:///C:/Users/alex/AppData/Roaming/whizmd/assets/geometry-1.svg)`)
    await waitFor(() => {
      const img = document.querySelector('.image-node .image-preview img')
      expect(img).not.toBeNull()
    })
    expect(document.querySelector('.image-node .image-preview img')!.getAttribute('src')).toBe(MEDIA_SRC)
  })

  it('keeps the image interactive after a content round-trip', async () => {
    setupApi()
    const onUpdate = vi.fn()
    const editor = await mountEditor(onUpdate)

    await act(async () => {
      await insertGeometryImage({
        svg: '<svg/>',
        docPath: null,
        editor,
        activeDocumentId: 'doc-1',
        hasActiveDocument: true,
        onStagedNotice: () => undefined,
        appendMarkdown: vi.fn()
      })
    })
    await waitFor(() => expect(onUpdate).toHaveBeenCalled())
    const serialized = onUpdate.mock.calls.at(-1)![0] as string

    // Simulate App storing the markdown and feeding it back through the editor.
    await act(async () => {
      editor.commands.setContent(serialized, { emitUpdate: false, contentType: 'markdown' })
    })
    await waitFor(() => {
      const img = document.querySelector('.image-node .image-preview img')
      expect(img).not.toBeNull()
    })
    expect(document.querySelector('.image-node .image-preview img')!.getAttribute('src')).toBe(MEDIA_SRC)
  })

  it('falls back to appending markdown when no live editor exists', async () => {
    setupApi()
    const appendMarkdown = vi.fn()
    const storedSrc = await insertGeometryImage({
      svg: '<svg/>',
      docPath: null,
      editor: null,
      activeDocumentId: 'doc-1',
      hasActiveDocument: true,
      onStagedNotice: () => undefined,
      appendMarkdown
    })
    expect(storedSrc.startsWith('media:///')).toBe(true)
    expect(appendMarkdown).toHaveBeenCalledWith(`![几何图](${storedSrc})`)
  })

  it('uses the relative path for saved documents', async () => {
    setupApi()
    const saveGeometry = window.markdownApp.file.saveGeometry as ReturnType<typeof vi.fn>
    saveGeometry.mockResolvedValue({ markdownPath: 'assets/geometry-1.svg', absolutePath: ASSET_PATH })
    const appendMarkdown = vi.fn()
    const storedSrc = await insertGeometryImage({
      svg: '<svg/>',
      docPath: 'C:/docs/guide.md',
      editor: null,
      activeDocumentId: 'doc-1',
      hasActiveDocument: true,
      onStagedNotice: () => undefined,
      appendMarkdown
    })
    expect(storedSrc).toBe('assets/geometry-1.svg')
    expect(appendMarkdown).toHaveBeenCalledWith('![几何图](assets/geometry-1.svg)')
  })
})

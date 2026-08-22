import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocumentStore } from '../../store/documents'
import { useDocumentActions } from '../useDocumentActions'
import type { FileNode, MarkdownAppApi } from '@shared/types'

const initialDocument = { id: 'untitled-1', path: null, content: '', dirty: false }
const translate = (key: string, values?: Record<string, string>): string =>
  `${key}${values?.error ? `: ${values.error}` : ''}`

const fileTree: FileNode = {
  name: 'notes',
  path: 'C:/notes',
  isDirectory: true,
  children: []
}

function createApi(overrides: Partial<MarkdownAppApi['file']> = {}): MarkdownAppApi {
  return {
    config: { get: vi.fn(), set: vi.fn() },
    help: { open: vi.fn(async () => null) },
    window: {
      setTitle: vi.fn(),
      onMenuCommand: vi.fn(() => vi.fn()),
      onCloseRequest: vi.fn(() => vi.fn()),
      readyForCloseRequests: vi.fn(),
      confirmClose: vi.fn()
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
      ...overrides
    },
    dir: { scan: vi.fn(async () => null) },
    exportHtml: vi.fn(),
    exportPdf: vi.fn(),
    getPathForFile: vi.fn(),
    mediaUrl: vi.fn()
  } as MarkdownAppApi
}

describe('useDocumentActions', () => {
  beforeEach(() => {
    useDocumentStore.setState({ documents: [initialDocument], activeDocumentId: initialDocument.id })
    vi.restoreAllMocks()
    window.alert = vi.fn()
    window.markdownApp = createApi()
  })

  it('opens a file once and selects it when opened again', async () => {
    const read = vi.fn(async () => '# Notes')
    window.markdownApp = createApi({ read })
    const { result } = renderHook(() => useDocumentActions(translate, vi.fn(), vi.fn()))

    await act(async () => result.current.openFile('C:/notes.md'))
    await act(async () => result.current.openFile('C:/notes.md'))

    expect(read).toHaveBeenCalledTimes(1)
    expect(useDocumentStore.getState().documents).toEqual([
      initialDocument,
      { id: expect.any(String), path: 'C:/notes.md', content: '# Notes', dirty: false }
    ])
    expect(useDocumentStore.getState().activeDocumentId).toMatch(/^file-/)
  })

  it('saves an untitled document and refreshes the folder tree', async () => {
    const saveFileDialog = vi.fn(async () => 'C:/notes.md')
    const write = vi.fn(async () => 'C:/notes.md')
    const scan = vi.fn(async () => fileTree)
    window.markdownApp = {
      ...createApi({ saveFileDialog, write, openDirectoryDialog: vi.fn(async () => 'C:/notes') }),
      dir: { scan }
    }
    useDocumentStore.getState().updateDocument('untitled-1', { content: '# Saved', dirty: true })
    const { result } = renderHook(() => useDocumentActions(translate, vi.fn(), vi.fn()))

    await act(async () => result.current.openFolder())
    await waitFor(() => expect(result.current.rootDir).toBe('C:/notes'))
    await act(async () => result.current.save())

    expect(saveFileDialog).toHaveBeenCalledWith('untitled.md')
    expect(write).toHaveBeenCalledWith('C:/notes.md', '# Saved')
    expect(useDocumentStore.getState().documents[0]).toMatchObject({
      path: 'C:/notes.md',
      dirty: false
    })
    expect(scan).toHaveBeenCalledWith('C:/notes')
    expect(result.current.fileTree).toEqual(fileTree)
  })

  it('coalesces concurrent save requests into one file write', async () => {
    let resolveWrite: (() => void) | undefined
    const write = vi.fn(() => new Promise<string>((resolve) => {
      resolveWrite = () => resolve('C:/notes.md')
    }))
    window.markdownApp = createApi({
      saveFileDialog: vi.fn(async () => 'C:/notes.md'),
      write
    })
    act(() => {
      useDocumentStore.getState().updateDocument('untitled-1', { content: 'draft', dirty: true })
    })
    const { result } = renderHook(() => useDocumentActions(translate, vi.fn(), vi.fn()))

    let firstSave: Promise<void> | undefined
    let secondSave: Promise<void> | undefined
    act(() => {
      firstSave = result.current.save()
      secondSave = result.current.save()
    })
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1))

    resolveWrite?.()
    await act(async () => Promise.all([firstSave, secondSave]))
    expect(useDocumentStore.getState().documents[0].dirty).toBe(false)
  })

  it('leaves an untitled document unchanged when save is cancelled', async () => {
    const saveFileDialog = vi.fn(async () => null)
    const write = vi.fn(async () => 'unused')
    window.markdownApp = createApi({ saveFileDialog, write })
    act(() => {
      useDocumentStore.getState().updateDocument('untitled-1', { content: 'draft', dirty: true })
    })
    const { result } = renderHook(() => useDocumentActions(translate, vi.fn(), vi.fn()))

    await act(async () => result.current.save())

    expect(saveFileDialog).toHaveBeenCalledWith('untitled.md')
    expect(write).not.toHaveBeenCalled()
    expect(useDocumentStore.getState().documents[0]).toMatchObject({ path: null, dirty: true })
  })

  it('closes a clean document immediately', () => {
    const onDocumentClosed = vi.fn()
    const { result } = renderHook(() => useDocumentActions(translate, vi.fn(), onDocumentClosed))

    act(() => result.current.closeCurrentDocument())

    expect(onDocumentClosed).toHaveBeenCalledTimes(1)
    expect(useDocumentStore.getState().documents[0].id).not.toBe('untitled-1')
  })

  it('does not remove a dirty document until the close callback is requested', () => {
    const requestDocumentClose = vi.fn()
    useDocumentStore.getState().updateDocument('untitled-1', { dirty: true })
    const { result } = renderHook(() => useDocumentActions(translate, requestDocumentClose, vi.fn()))

    act(() => result.current.closeCurrentDocument())

    expect(requestDocumentClose).toHaveBeenCalledTimes(1)
    expect(useDocumentStore.getState().documents).toHaveLength(1)
  })

  it('replaces the final document when discarding an unsaved document', () => {
    const onDocumentClosed = vi.fn()
    const { result } = renderHook(() => useDocumentActions(translate, vi.fn(), onDocumentClosed))
    const oldId = useDocumentStore.getState().activeDocumentId

    act(() => result.current.removeCurrentDocument())

    const state = useDocumentStore.getState()
    expect(onDocumentClosed).toHaveBeenCalledTimes(1)
    expect(state.documents).toHaveLength(1)
    expect(state.documents[0].id).not.toBe(oldId)
    expect(state.documents[0]).toMatchObject({ path: null, content: '', dirty: false })
    expect(state.activeDocumentId).toBe(state.documents[0].id)
  })

  it('reports read and write failures without corrupting document state', async () => {
    const read = vi.fn(async () => { throw new Error('read failed') })
    const write = vi.fn(async () => { throw new Error('write failed') })
    const alert = vi.spyOn(window, 'alert')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    window.markdownApp = createApi({ read, write })
    const { result } = renderHook(() => useDocumentActions(translate, vi.fn(), vi.fn()))

    await act(async () => result.current.openFile('C:/broken.md'))
    act(() => {
      useDocumentStore.getState().updateDocument('untitled-1', {
        path: 'C:/draft.md',
        content: 'draft',
        dirty: true
      })
    })
    await act(async () => result.current.save())
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(2))

    expect(alert).toHaveBeenNthCalledWith(1, 'openFailed: read failed')
    expect(alert).toHaveBeenNthCalledWith(2, 'saveFailed: write failed')
    expect(consoleError).toHaveBeenCalledTimes(2)
    expect(useDocumentStore.getState().documents[0]).toMatchObject({ path: 'C:/draft.md', content: 'draft', dirty: true })
  })
})

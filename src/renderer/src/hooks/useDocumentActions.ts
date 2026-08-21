import { useCallback, useRef, useState } from 'react'
import { useDocumentStore } from '../store/documents'
import type { FileNode } from '@shared/types'

type Translator = (key: 'saveFailed' | 'openFailed', values?: Record<string, string>) => string

export function useDocumentActions(t: Translator, requestDocumentClose: () => void, onDocumentClosed: () => void) {
  const documents = useDocumentStore((state) => state.documents)
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId)
  const addDocument = useDocumentStore((state) => state.addDocument)
  const updateDocument = useDocumentStore((state) => state.updateDocument)
  const setActiveDocument = useDocumentStore((state) => state.setActiveDocument)
  const replaceDocuments = useDocumentStore((state) => state.replaceDocuments)
  const activeDocument = documents.find((file) => file.id === activeDocumentId) ?? documents[0]
  const hasUnsavedChanges = documents.some((file) => file.dirty)
  const [rootDir, setRootDir] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const saveInFlightRef = useRef<Promise<void> | null>(null)

  const handleUpdate = useCallback((content: string): void => {
    updateDocument(activeDocumentId, { content, dirty: true })
  }, [activeDocumentId, updateDocument])

  const save = useCallback(async (): Promise<void> => {
    if (saveInFlightRef.current) return saveInFlightRef.current
    const operation = (async (): Promise<void> => {
      const state = useDocumentStore.getState()
      const document = state.documents.find((file) => file.id === state.activeDocumentId)
      if (!document) return
      let target = document.path
      if (!target) target = await window.markdownApp.file.saveFileDialog('untitled.md')
      if (!target) return
      await window.markdownApp.file.write(target, document.content)
      updateDocument(document.id, { path: target, dirty: false })
      if (rootDir) setFileTree(await window.markdownApp.dir.scan(rootDir))
    })()
    saveInFlightRef.current = operation
    try { await operation } catch (error) {
      console.error('Failed to save document', error)
      window.alert(t('saveFailed', { error: error instanceof Error ? error.message : String(error) }))
    } finally {
      if (saveInFlightRef.current === operation) saveInFlightRef.current = null
    }
  }, [rootDir, t, updateDocument])

  const openFile = useCallback(async (path: string): Promise<void> => {
    const state = useDocumentStore.getState()
    const existing = state.documents.find((file) => file.path === path)
    if (existing?.id === state.activeDocumentId) return
    try {
      const next = existing ?? { id: `file-${Date.now()}`, path, content: await window.markdownApp.file.read(path), dirty: false }
      if (!existing) addDocument(next)
      setActiveDocument(next.id)
    } catch (error) {
      console.error('Failed to open document', error)
      window.alert(t('openFailed', { error: error instanceof Error ? error.message : String(error) }))
    }
  }, [addDocument, setActiveDocument, t])

  const openFolder = useCallback(async (): Promise<void> => {
    const directory = await window.markdownApp.file.openDirectoryDialog()
    if (!directory) return
    setRootDir(directory)
    setFileTree(await window.markdownApp.dir.scan(directory))
  }, [])

  const openFileDialog = useCallback(async (): Promise<void> => {
    const path = await window.markdownApp.file.openDialog()
    if (path) await openFile(path)
  }, [openFile])

  const newFile = useCallback((): void => {
    const id = `untitled-${Date.now()}`
    addDocument({ id, path: null, content: '', dirty: false })
    setActiveDocument(id)
  }, [addDocument, setActiveDocument])

  const selectDocument = useCallback((id: string): void => {
    if (id !== activeDocumentId && documents.some((file) => file.id === id)) setActiveDocument(id)
  }, [activeDocumentId, documents, setActiveDocument])

  const removeCurrentDocument = useCallback((): void => {
    onDocumentClosed()
    const state = useDocumentStore.getState()
    const remaining = state.documents.filter((file) => file.id !== state.activeDocumentId)
    const next = remaining[0]
    if (next) replaceDocuments(remaining, next.id)
    else {
      const id = `untitled-${Date.now()}`
      replaceDocuments([{ id, path: null, content: '', dirty: false }], id)
    }
  }, [newFile, onDocumentClosed, replaceDocuments])

  const closeCurrentDocument = useCallback((): void => {
    const state = useDocumentStore.getState()
    const current = state.documents.find((file) => file.id === state.activeDocumentId)
    if (current?.dirty) { requestDocumentClose(); return }
    removeCurrentDocument()
  }, [removeCurrentDocument, requestDocumentClose])

  const saveAndCloseDocument = useCallback(async (): Promise<void> => {
    await save()
    if (!useDocumentStore.getState().documents.find((file) => file.id === activeDocumentId)?.dirty) removeCurrentDocument()
  }, [activeDocumentId, removeCurrentDocument, save])

  return { documents, activeDocumentId, activeDocument, hasUnsavedChanges, rootDir, fileTree, handleUpdate, save, openFile, openFolder, openFileDialog, newFile, selectDocument, closeCurrentDocument, removeCurrentDocument, saveAndCloseDocument }
}

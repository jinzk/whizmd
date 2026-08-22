import { useCallback, useRef, useState } from 'react'
import { useDocumentStore } from '../store/documents'
import { useFileOperations } from './useFileOperations'

type Translator = (key: 'saveFailed' | 'openFailed', values?: Record<string, string>) => string
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useDocumentActions(t: Translator, requestDocumentClose: () => void, onDocumentClosed: () => void, onError?: (message: string) => void, markdownOnly = true) {
  const documents = useDocumentStore((state) => state.documents)
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId)
  const addDocument = useDocumentStore((state) => state.addDocument)
  const updateDocument = useDocumentStore((state) => state.updateDocument)
  const setActiveDocument = useDocumentStore((state) => state.setActiveDocument)
  const replaceDocuments = useDocumentStore((state) => state.replaceDocuments)
  const activeDocument = documents.find((file) => file.id === activeDocumentId) ?? documents[0]
  const hasUnsavedChanges = documents.some((file) => file.dirty)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const saveInFlightRef = useRef<Promise<void> | null>(null)

  const handleUpdate = useCallback((content: string): void => {
    updateDocument(activeDocumentId, { content, dirty: true })
    setSaveStatus('idle')
  }, [activeDocumentId, updateDocument])

  const openFile = useCallback(async (path: string): Promise<void> => {
    const state = useDocumentStore.getState()
    const existing = state.documents.find((file) => file.path === path)
    if (existing?.id === state.activeDocumentId) return
    try {
      const next = existing ?? { id: `file-${Date.now()}`, path, content: await window.markdownApp.file.read(path), dirty: false }
      if (!existing) addDocument(next)
      setActiveDocument(next.id)
      void window.markdownApp.recent?.addFile(path)
    } catch (error) {
      console.error('Failed to open document', error)
      const message = t('openFailed', { error: error instanceof Error ? error.message : String(error) })
      if (onError) onError(message)
      else window.alert(message)
    }
  }, [addDocument, onError, setActiveDocument, t])

  const { rootDir, fileTree, setFileTree, treeStatus, openFolder, openFolderPath, openFileDialog, refresh } = useFileOperations(openFile, markdownOnly)

  const save = useCallback(async (): Promise<void> => {
    if (saveInFlightRef.current) return saveInFlightRef.current
    const operation = (async (): Promise<void> => {
      setSaveStatus('saving')
      const state = useDocumentStore.getState()
      const document = state.documents.find((file) => file.id === state.activeDocumentId)
      if (!document) {
        setSaveStatus('idle')
        return
      }
      let target = document.path
      if (!target) target = await window.markdownApp.file.saveFileDialog('untitled.md')
      if (!target) {
        setSaveStatus('idle')
        return
      }
      await window.markdownApp.file.write(target, document.content)
      updateDocument(document.id, { path: target, dirty: false })
      setSaveStatus('saved')
       if (rootDir) {
         const result = await window.markdownApp.dir.scan(rootDir)
         setFileTree('tree' in result ? result.tree : null)
       }
    })()
    saveInFlightRef.current = operation
    try { await operation } catch (error) {
      console.error('Failed to save document', error)
      setSaveStatus('error')
      const message = t('saveFailed', { error: error instanceof Error ? error.message : String(error) })
      if (onError) onError(message)
      else window.alert(message)
    } finally {
      if (saveInFlightRef.current === operation) saveInFlightRef.current = null
    }
  }, [onError, rootDir, setFileTree, t, updateDocument])

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
    const currentIndex = state.documents.findIndex((file) => file.id === state.activeDocumentId)
    const remaining = state.documents.filter((file) => file.id !== state.activeDocumentId)
    const next = remaining[Math.min(Math.max(currentIndex, 0), remaining.length - 1)]
    if (next) replaceDocuments(remaining, next.id)
    else {
      const id = `untitled-${Date.now()}`
      replaceDocuments([{ id, path: null, content: '', dirty: false }], id)
    }
  }, [onDocumentClosed, replaceDocuments])

  const closeDocument = useCallback((id: string): void => {
    const state = useDocumentStore.getState()
    const current = state.documents.find((file) => file.id === id)
    if (!current) return
    if (id !== state.activeDocumentId) setActiveDocument(id)
    if (current.dirty) { requestDocumentClose(); return }
    removeCurrentDocument()
  }, [removeCurrentDocument, requestDocumentClose, setActiveDocument])

  const closeCurrentDocument = useCallback((): void => {
    closeDocument(useDocumentStore.getState().activeDocumentId)
  }, [closeDocument])

  const saveAndCloseDocument = useCallback(async (): Promise<void> => {
    await save()
    if (!useDocumentStore.getState().documents.find((file) => file.id === activeDocumentId)?.dirty) removeCurrentDocument()
  }, [activeDocumentId, removeCurrentDocument, save])

  const saveAllDocuments = useCallback(async (): Promise<boolean> => {
    const state = useDocumentStore.getState()
    const originalId = state.activeDocumentId
    const dirtyIds = state.documents.filter((file) => file.dirty).map((file) => file.id)
    for (const id of dirtyIds) {
      setActiveDocument(id)
      await save()
      if (useDocumentStore.getState().documents.find((file) => file.id === id)?.dirty) {
        setActiveDocument(originalId)
        return false
      }
    }
    setActiveDocument(originalId)
    return true
  }, [save, setActiveDocument])

  return { documents, activeDocumentId, activeDocument, hasUnsavedChanges, rootDir, fileTree, treeStatus, handleUpdate, save, saveAllDocuments, saveStatus, openFile, openFolder, openFolderPath, openFileDialog, refresh, newFile, selectDocument, closeCurrentDocument, closeDocument, removeCurrentDocument, saveAndCloseDocument }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileNode } from '@shared/types'
import { useEditorStore } from './store/editor'
import { useDocumentStore } from './store/documents'
import { WysiwygEditor } from './components/WysiwygEditor'
import { SourceEditor } from './components/SourceEditor'
import { FileSidebar } from './components/FileSidebar'
import { buildExportHtml } from './export/buildHtml'
import { useTheme } from './hooks/useTheme'
import type { ThemeMode } from '@shared/types'
import type { LanguageMode, MenuCommand } from '@shared/types'
import { useI18n } from './i18n'

const THEME_CYCLE: ThemeMode[] = ['system', 'light', 'dark']

export function App(): React.JSX.Element {
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const config = useEditorStore((s) => s.config)
  const setConfig = useEditorStore((s) => s.setConfig)
  const openedFiles = useDocumentStore((s) => s.documents)
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const activeDocument = openedFiles.find((file) => file.id === activeDocumentId) ?? openedFiles[0]
  const addDocument = useDocumentStore((s) => s.addDocument)
  const updateDocument = useDocumentStore((s) => s.updateDocument)
  const setActiveDocument = useDocumentStore((s) => s.setActiveDocument)
  const replaceDocuments = useDocumentStore((s) => s.replaceDocuments)

  const theme = useTheme()
  const { t } = useI18n()

  const [rootDir, setRootDir] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closeHasUnsavedChanges, setCloseHasUnsavedChanges] = useState(false)
  const [documentCloseDialogOpen, setDocumentCloseDialogOpen] = useState(false)
  const languageMenuRef = useRef<HTMLDivElement>(null)
  const saveInFlightRef = useRef<Promise<void> | null>(null)
  const docPath = activeDocument?.path ?? null
  useEffect(() => {
    void window.markdownApp.config.get().then(setConfig)
  }, [setConfig])

  useEffect(() => {
    const removeListener = window.markdownApp.window.onCloseRequest(() => {
      setCloseHasUnsavedChanges(useDocumentStore.getState().documents.some((file) => file.dirty))
      setCloseDialogOpen(true)
    })
    void window.markdownApp.window.readyForCloseRequests()
    return removeListener
  }, [])

  useEffect(() => {
    const fileName = docPath?.split(/[\\/]/).pop()
    const title = fileName?.replace(/\.(md|markdown|txt)$/i, '') || t('untitledDocument')
    void window.markdownApp.window.setTitle(title)
  }, [docPath, t])

  const handleUpdate = useCallback((md: string): void => {
    updateDocument(activeDocumentId, { content: md, dirty: true })
  }, [activeDocumentId, updateDocument])

  const enterMode = useCallback((target: 'wysiwyg' | 'source'): void => setMode(target), [setMode])

  const save = useCallback(async (): Promise<void> => {
    if (saveInFlightRef.current) {
      await saveInFlightRef.current
      return
    }

    const operation = (async (): Promise<void> => {
      const state = useDocumentStore.getState()
      const document = state.documents.find((file) => file.id === state.activeDocumentId)
      if (!document) return
      const sourcePath = document.path
      const current = document.content
      let target = sourcePath
      if (!target) {
        target = await window.markdownApp.file.saveFileDialog('untitled.md')
        if (!target) {
          return
        }
      }
      await window.markdownApp.file.write(target, current)
      updateDocument(document.id, { path: target, content: current, dirty: false })
      if (rootDir) {
        const tree = await window.markdownApp.dir.scan(rootDir)
        setFileTree(tree)
      }
    })()

    saveInFlightRef.current = operation
    try {
      await operation
    } catch (error) {
      console.error('Failed to save document', error)
      window.alert(
        t('saveFailed', { error: error instanceof Error ? error.message : String(error) })
      )
    } finally {
      if (saveInFlightRef.current === operation) {
        saveInFlightRef.current = null
      }
    }
  }, [rootDir, t, updateDocument])

  const openFile = useCallback(
    async (path: string) => {
      const state = useDocumentStore.getState()
      const existing = state.documents.find((file) => file.path === path)
      if (existing?.id === state.activeDocumentId) return
      try {
        const next = existing ?? {
          id: `file-${Date.now()}`,
          path,
          content: await window.markdownApp.file.read(path),
          dirty: false
        }
        if (!existing) addDocument(next)
        setActiveDocument(next.id)
      } catch (error) {
        console.error('Failed to open document', error)
        window.alert(
          t('openFailed', { error: error instanceof Error ? error.message : String(error) })
        )
      }
    },
    [addDocument, setActiveDocument, t]
  )

  const openFolder = useCallback(async () => {
    const dir = await window.markdownApp.file.openDirectoryDialog()
    if (!dir) {
      return
    }
    const tree = await window.markdownApp.dir.scan(dir)
    setRootDir(dir)
    setFileTree(tree)
  }, [])

  const openFileDialog = useCallback(async () => {
    const path = await window.markdownApp.file.openDialog()
    if (path) {
      await openFile(path)
    }
  }, [openFile])

  const selectDocument = useCallback(
    (id: string): void => {
      if (id === activeDocumentId) return
      const target = useDocumentStore.getState().documents.find((file) => file.id === id)
      if (!target) return
      setActiveDocument(target.id)
    },
    [activeDocumentId, setActiveDocument]
  )

  const closeCurrentDocument = useCallback((): void => {
    const state = useDocumentStore.getState()
    const current = state.documents.find((file) => file.id === activeDocumentId)
    if (current?.dirty) {
      setDocumentCloseDialogOpen(true)
      return
    }
    const remaining = state.documents.filter((file) => file.id !== activeDocumentId)
    if (remaining.length > 0) {
      replaceDocuments(remaining, remaining[0].id)
    } else {
      const id = `untitled-${Date.now()}`
      replaceDocuments([{ id, path: null, content: '', dirty: false }], id)
    }
  }, [activeDocumentId, replaceDocuments])

  const removeCurrentDocument = useCallback((): void => {
    setDocumentCloseDialogOpen(false)
    const state = useDocumentStore.getState()
    const remaining = state.documents.filter((file) => file.id !== activeDocumentId)
    const next = remaining[0]
    if (next) {
      replaceDocuments(remaining, next.id)
    } else {
      const id = `untitled-${Date.now()}`
      replaceDocuments([{ id, path: null, content: '', dirty: false }], id)
    }
  }, [activeDocumentId, replaceDocuments])

  const saveAndCloseDocument = useCallback(async (): Promise<void> => {
    await save()
    if (!useDocumentStore.getState().documents.find((file) => file.id === activeDocumentId)?.dirty) {
      removeCurrentDocument()
    }
  }, [activeDocumentId, removeCurrentDocument, save])

  const newFile = useCallback(() => {
    const id = `untitled-${Date.now()}`
    addDocument({ id, path: null, content: '', dirty: false })
    setActiveDocument(id)
  }, [addDocument, setActiveDocument])

  useEffect(() => {
    if (!languageMenuOpen) return
    const onPointerDown = (event: MouseEvent): void => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setLanguageMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [languageMenuOpen])

  const exportTitle = useCallback(
    (path: string | null): string => {
      if (!path) {
        return t('untitled')
      }
      const base = path.split(/[\\/]/).pop() ?? t('untitled')
      return base.replace(/\.(md|markdown|txt)$/i, '') || t('untitled')
    },
    [t]
  )

  const exportDefaultPath = useCallback((path: string | null, ext: 'html' | 'pdf'): string => {
    if (!path) {
      return `untitled.${ext}`
    }
    return path.replace(/\.(md|markdown|txt)$/i, '') + `.${ext}`
  }, [])

  const exportDocument = useCallback(
    async (kind: 'html' | 'pdf') => {
      const path = useDocumentStore.getState().documents.find((file) => file.id === activeDocumentId)?.path ?? null
      const md = useDocumentStore.getState().documents.find((file) => file.id === activeDocumentId)?.content ?? ''
      const html = await buildExportHtml(md, {
        title: exportTitle(path),
        docPath: path
      })
      if (kind === 'html') {
        await window.markdownApp.exportHtml({
          html,
          defaultPath: exportDefaultPath(path, 'html')
        })
      } else {
        await window.markdownApp.exportPdf({
          html,
          defaultPath: exportDefaultPath(path, 'pdf')
        })
      }
    },
    [activeDocumentId, exportDefaultPath, exportTitle]
  )

  useEffect(() => {
    const actions: Record<MenuCommand, () => void> = {
      'new-file': newFile,
      'open-folder': () => void openFolder(),
      'open-file': () => void openFileDialog(),
      'close-file': closeCurrentDocument,
      save: () => void save(),
      'export-html': () => void exportDocument('html'),
      'export-pdf': () => void exportDocument('pdf')
    }
    return window.markdownApp.window.onMenuCommand((command) => actions[command]())
  }, [closeCurrentDocument, exportDocument, newFile, openFileDialog, openFolder, save])

  // Global shortcuts: Ctrl/Cmd+S save, Ctrl/Cmd+O open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) {
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'n') {
        e.preventDefault()
        newFile()
      } else if (key === 's') {
        e.preventDefault()
        void save()
      } else if (key === 'o') {
        e.preventDefault()
        void openFileDialog()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [newFile, save, openFileDialog])

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <button type="button" onClick={newFile}>
            {t('newFile')}
          </button>
          <button type="button" onClick={() => void save()}>
            {t('save')}
          </button>
          <span className="toolbar-sep" />
          <div className="mode-switch" role="group" aria-label={t('editMode')}>
            <button
              type="button"
              className={mode === 'wysiwyg' ? 'active' : ''}
              onClick={() => enterMode('wysiwyg')}
            >
              {t('edit')}
            </button>
            <button
              type="button"
              className={mode === 'source' ? 'active' : ''}
              onClick={() => enterMode('source')}
            >
              {t('source')}
            </button>
          </div>
        </div>
        <div className="toolbar-right">
          <button
            type="button"
            onClick={() => {
              const next =
                THEME_CYCLE[
                  (THEME_CYCLE.indexOf(config?.themeMode ?? 'system') + 1) % THEME_CYCLE.length
                ]
              void window.markdownApp.config.set({ themeMode: next }).then(setConfig)
            }}
            title={t('switchTheme')}
          >
            {config?.themeMode === 'light'
              ? t('lightTheme')
              : config?.themeMode === 'dark'
                ? t('darkTheme')
                : t('systemTheme')}
          </button>
          <div className="toolbar-menu" ref={languageMenuRef}>
            <button
              type="button"
              className="toolbar-menu-trigger"
              aria-label={t('language')}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              onClick={() => setLanguageMenuOpen((open) => !open)}
            >
              {t('language')}:{' '}
              {config?.language === 'zh-CN'
                ? t('chinese')
                : config?.language === 'en-US'
                  ? t('english')
                  : t('system')}
              <span className="toolbar-menu-chevron" aria-hidden="true">
                ▾
              </span>
            </button>
            {languageMenuOpen ? (
              <div className="toolbar-menu-content" role="menu" aria-label={t('language')}>
                {(
                  [
                    ['system', t('system')],
                    ['zh-CN', t('chinese')],
                    ['en-US', t('english')]
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={(config?.language ?? 'system') === value}
                    onClick={() => {
                      setLanguageMenuOpen(false)
                      void window.markdownApp.config
                        .set({ language: value as LanguageMode })
                        .then(setConfig)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="main-layout">
        <FileSidebar
          root={fileTree}
          rootDir={rootDir}
          activePath={docPath}
          activeDocumentId={activeDocumentId}
          openedFiles={openedFiles}
          onOpenFile={(p) => void openFile(p)}
          onSelectDocument={selectDocument}
        />
        <main className="editor-area">
          {mode === 'wysiwyg' ? (
            <WysiwygEditor
              key={activeDocumentId}
              content={activeDocument?.content ?? ''}
              onUpdate={handleUpdate}
            />
          ) : (
            <SourceEditor
              content={activeDocument?.content ?? ''}
              onUpdate={handleUpdate}
              theme={theme}
            />
          )}
        </main>
      </div>
      {closeDialogOpen ? (
        <div className="app-dialog-backdrop" role="presentation">
          <div
            className="app-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="close-dialog-title"
          >
            <h2 id="close-dialog-title">{t('closeWindow')}</h2>
            <p>{t(closeHasUnsavedChanges ? 'closeUnsavedMessage' : 'closeMessage')}</p>
            <div className="app-dialog-actions">
              <button type="button" onClick={() => setCloseDialogOpen(false)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="app-dialog-danger"
                onClick={() => void window.markdownApp.window.confirmClose()}
              >
                {t('continueClose')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {documentCloseDialogOpen ? (
        <div className="app-dialog-backdrop" role="presentation">
          <div className="app-dialog" role="alertdialog" aria-modal="true">
            <h2>{t('closeFile')}</h2>
            <p>{t('closeDocumentMessage')}</p>
            <div className="app-dialog-actions">
              <button type="button" onClick={() => setDocumentCloseDialogOpen(false)}>
                {t('cancel')}
              </button>
              <button type="button" onClick={() => void saveAndCloseDocument()}>
                {t('saveAndClose')}
              </button>
              <button type="button" className="app-dialog-danger" onClick={removeCurrentDocument}>
                {t('discardChanges')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

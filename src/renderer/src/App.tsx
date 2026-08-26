import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from './store/editor'
import { WysiwygEditor } from './components/WysiwygEditor'
import { SourceEditor } from './components/SourceEditor'
import { FileSidebar } from './components/FileSidebar'
import { buildExportHtml } from './export/buildHtml'
import { useTheme } from './hooks/useTheme'
import type { AppConfig, MenuCommand } from '@shared/types'
import { useI18n } from './i18n'
import { useDocumentActions } from './hooks/useDocumentActions'
import { useDocumentStore } from './store/documents'
import { AppToolbar } from './components/AppToolbar'
import { DocumentStatusBar } from './components/DocumentStatusBar'
import { Dialog } from './components/Dialog'
import { Toast, type AppNotice } from './components/Toast'
import { SettingsDialog } from './components/SettingsDialog'
import type { EditorInsertAction } from './components/EditorContextMenu'
import { GeometryEditorDialog } from './components/GeometryEditorDialog'
import { deserializeGeometrySvg, type GeometryDocument } from './geometry'
import { insertGeometryImage } from './services/insertGeometryImage'
import type { Editor } from '@tiptap/core'

export function App(): React.JSX.Element {
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const config = useEditorStore((s) => s.config)
  const setConfig = useEditorStore((s) => s.setConfig)
  const theme = useTheme()
  const { t } = useI18n()

  const [documentCloseDialogOpen, setDocumentCloseDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [geometryOpen, setGeometryOpen] = useState(false)
  const [geometryDocument, setGeometryDocument] = useState<GeometryDocument | undefined>()
  const [geometryExistingPath, setGeometryExistingPath] = useState<string | undefined>()
  const geometryEditorRef = useRef<Editor | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<AppConfig | null>(null)
  const [notices, setNotices] = useState<AppNotice[]>([])
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [recentFolders, setRecentFolders] = useState<string[]>([])
  const restoredRecentFile = useRef(false)
  const userCreatedDocument = useRef(false)
  const requestDocumentClose = useCallback(() => setDocumentCloseDialogOpen(true), [])
  const showMarkdownOnly = config?.showMarkdownOnly ?? true
  const notify = useCallback((message: string, type: AppNotice['type'] = 'error', action?: AppNotice['action']): void => setNotices((current) => [...current.filter((notice) => notice.message !== message), { id: `${Date.now()}-${Math.random()}`, type, message, action }].slice(-4)), [])
  const { documents: openedFiles, activeDocumentId, activeDocument, hasUnsavedChanges, rootDir, fileTree, treeStatus, handleUpdate, save, saveStatus, openFile, openFolder, openFolderPath, openFileDialog, refresh, newFile, selectDocument, closeCurrentDocument, closeDocument, removeCurrentDocument, saveAndCloseDocument } = useDocumentActions(t, requestDocumentClose, () => setDocumentCloseDialogOpen(false), notify, showMarkdownOnly)
  const handleNewFile = useCallback((): void => {
    userCreatedDocument.current = true
    newFile()
  }, [newFile])
  const docPath = activeDocument?.path ?? null
  const documentContent = activeDocument?.content ?? ''
  const setDocumentRootDir = useDocumentStore((state) => state.setRootDir)
  const lineCount = documentContent ? documentContent.split(/\r?\n/).length : 1
  const characterCount = documentContent.length
  useEffect(() => { setDocumentRootDir(rootDir) }, [rootDir, setDocumentRootDir])
  useEffect(() => {
    void window.markdownApp.config.get().then(setConfig)
  }, [setConfig])

  useEffect(() => window.markdownApp.window.onRecentMenuTarget((target) => {
    if (target.kind === 'clear') {
      void window.markdownApp.recent?.clear().then((recent) => { setRecentFiles(recent.files); setRecentFolders(recent.folders) })
    } else if (target.kind === 'file') {
      void window.markdownApp.file.openRecent(target.path).then(() => openFile(target.path)).catch(() => notify(t('fileNotFound')))
    } else {
      void window.markdownApp.file.openRecentFolder(target.path).then(() => openFolderPath(target.path)).catch(() => notify(t('folderScanFailed')))
    }
  }), [notify, openFile, openFolderPath, t])

  useEffect(() => {
    if (!config || restoredRecentFile.current) return
    restoredRecentFile.current = true
    let cancelled = false
    if (!window.markdownApp.recent) return
    void window.markdownApp.recent.list().then((recent) => {
      const path = recent.files[0]
      if (path) void window.markdownApp.file.openRecent(path).then(() => {
        if (!cancelled && !userCreatedDocument.current) return openFile(path)
      }).catch(() => {})
    }).catch(() => {})
    return () => { cancelled = true }
  }, [config, openFile])

  useEffect(() => {
    const openGeometry = async (event: Event): Promise<void> => {
      const src = (event as CustomEvent<{ src: string }>).detail?.src
      if (!src) return
      try {
      const svg = await window.markdownApp.file.readGeometry(src, docPath)
        const document = svg ? deserializeGeometrySvg(svg) : null
        if (document) { setGeometryDocument(document); setGeometryExistingPath(src); setGeometryOpen(true) }
      } catch { /* External or unavailable SVG remains a normal image. */ }
    }
    window.addEventListener('whizmd:edit-geometry', openGeometry)
    return () => window.removeEventListener('whizmd:edit-geometry', openGeometry)
  }, [docPath])

  useEffect(() => {
    void window.markdownApp.recent?.list().then((recent) => { setRecentFiles(recent.files); setRecentFolders(recent.folders) })
  }, [docPath])

  useEffect(() => {
    void window.markdownApp.window.setDirty(hasUnsavedChanges)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (config) void window.markdownApp.window.setLanguage(config.language)
  }, [config])

  useEffect(() => {
    const fileName = docPath?.split(/[\\/]/).pop()
    const title = fileName?.replace(/\.(md|markdown|txt)$/i, '') || t('untitledDocument')
    void window.markdownApp.window.setTitle(title)
  }, [docPath, t])

  useEffect(() => {
    if (!config?.autoSave || !activeDocument?.dirty || !activeDocument.path) return
    let cancelled = false
    let retryTimer: number | null = null
    const attempt = (attemptNumber: number): void => {
      void save().then(() => {
        if (cancelled) return
        const stillDirty = useDocumentStore.getState().documents.find((file) => file.id === activeDocumentId)?.dirty
        if (stillDirty && attemptNumber < 3) {
          notify(t('saveRetry'), 'info', { label: t('retry'), onClick: () => void save() })
          retryTimer = window.setTimeout(() => attempt(attemptNumber + 1), attemptNumber === 1 ? 1000 : 3000)
        } else if (stillDirty) {
          notify(t('saveError'))
        }
      })
    }
    const timer = window.setTimeout(() => attempt(1), config.autoSaveDelay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (retryTimer !== null) window.clearTimeout(retryTimer)
    }
  }, [activeDocument?.content, activeDocument?.dirty, activeDocument?.path, activeDocumentId, config?.autoSave, config?.autoSaveDelay, notify, save, t])

  useEffect(() => {
    if (!notices.length) return
    const timers = notices.map((notice) => window.setTimeout(() => setNotices((current) => current.filter((item) => item.id !== notice.id)), notice.type === 'error' ? 7000 : 4500))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [notices])

  const showSettings = useCallback((): void => {
    if (!config) return
    setSettingsDraft({ ...config })
    setSettingsOpen(true)
  }, [config])

  const closeSettings = useCallback((): void => {
    setSettingsOpen(false)
    setSettingsDraft(null)
  }, [])

  const applySettings = useCallback(async (next: AppConfig): Promise<void> => {
    const saved = await window.markdownApp.config.set(next)
    setConfig(saved)
    closeSettings()
  }, [closeSettings, setConfig])

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
      const path = activeDocument?.path ?? null
      const md = activeDocument?.content ?? ''
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
    [activeDocument, exportDefaultPath, exportTitle]
  )
  const handleInsertAction = useCallback((action: EditorInsertAction): void => {
    if (action === 'geometry') setGeometryOpen(true)
  }, [])
  const handleDrawGeometry = useCallback((): void => setGeometryOpen(true), [])
  const saveGeometry = useCallback(async (svg: string): Promise<void> => {
    try {
      await insertGeometryImage({
        svg,
        docPath,
        existingPath: geometryExistingPath,
        editor: geometryEditorRef.current,
        activeDocumentId: activeDocument?.id ?? '',
        hasActiveDocument: Boolean(activeDocument),
        onStagedNotice: () => notify(t('geometryStagedNotice'), 'info'),
        appendMarkdown: (image) => handleUpdate(activeDocument?.content ? `${activeDocument.content}\n\n${image}` : image)
      })
      setGeometryOpen(false)
    } catch (error) {
      notify(`几何图保存失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }, [activeDocument, docPath, geometryExistingPath, handleUpdate, notify, t])

  useEffect(() => {
    const actions: Record<MenuCommand, () => void> = {
       'new-file': handleNewFile,
      'open-folder': () => void openFolder(),
      'open-file': () => void openFileDialog(),
      'close-file': closeCurrentDocument,
      save: () => void save(),
      'export-html': () => void exportDocument('html'),
      'export-pdf': () => void exportDocument('pdf'),
      'open-help': () => void window.markdownApp.help.open().then((path) => {
        if (path) void openFile(path)
      })
    }
    return window.markdownApp.window.onMenuCommand((command) => actions[command]())
  }, [closeCurrentDocument, exportDocument, handleNewFile, openFile, openFileDialog, openFolder, save])

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
        handleNewFile()
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
  }, [handleNewFile, save, openFileDialog])

  return (
    <div className="app">
      <AppToolbar
        mode={mode}
        docTitle={exportTitle(docPath)}
        dirty={hasUnsavedChanges}
        saveStatus={saveStatus}
         onNew={handleNewFile}
        onSave={() => void save()}
        onModeChange={setMode}
         onSettings={showSettings}
         onDrawGeometry={handleDrawGeometry}
      />
      {geometryOpen ? <GeometryEditorDialog existingPath={geometryExistingPath} initialDocument={geometryDocument} onClose={() => { setGeometryOpen(false); setGeometryDocument(undefined); setGeometryExistingPath(undefined) }} onSave={saveGeometry} /> : null}

      <div className="main-layout">
        <FileSidebar
          root={fileTree}
          rootDir={rootDir}
          activePath={docPath}
          activeDocumentId={activeDocumentId}
          openedFiles={openedFiles}
          onOpenFile={(p) => void openFile(p)}
          onSelectDocument={selectDocument}
          onCloseDocument={closeDocument}
          onRefresh={refresh}
          showMarkdownOnly={showMarkdownOnly}
          onToggleMarkdownOnly={() => {
            const next = !showMarkdownOnly
            void window.markdownApp.config.set({ showMarkdownOnly: next }).then(setConfig)
          }}
          treeStatus={treeStatus}
          recentFiles={recentFiles}
          recentFolders={recentFolders}
          onOpenRecent={(path) => void window.markdownApp.file.openRecent(path).then(() => openFile(path)).catch(() => notify(t('fileNotFound')))}
          onOpenRecentFolder={(path) => void openFolderPath(path)}
          onRemoveRecent={(path) => void window.markdownApp.recent?.removeFile(path).then((recent) => setRecentFiles(recent.files))}
          onRemoveRecentFolder={(path) => void window.markdownApp.recent?.removeFolder(path).then((recent) => setRecentFolders(recent.folders))}
          onClearRecent={() => void window.markdownApp.recent?.clear().then(() => { setRecentFiles([]); setRecentFolders([]) })}
        />
        <main className="editor-area" style={{ '--editor-font-size': `${config?.editorFontSize ?? 16}px`, '--editor-content-width': `${config?.editorContentWidth ?? 800}px` } as React.CSSProperties}>
          {mode === 'wysiwyg' ? (
            <WysiwygEditor
              key={activeDocumentId}
              content={activeDocument?.content ?? ''}
              onUpdate={handleUpdate}
               spellCheck={config?.spellCheck}
               onInsertAction={handleInsertAction}
               onEditorReady={(instance) => { geometryEditorRef.current = instance }}
          onEditorDestroy={() => { geometryEditorRef.current = null }}
            />
          ) : (
            <SourceEditor
              content={activeDocument?.content ?? ''}
              onUpdate={handleUpdate}
              theme={theme}
              spellCheck={config?.spellCheck}
            />
          )}
          {activeDocument?.path && !activeDocument.content ? (
            <div className="empty-document-hint">
              <strong>{t('emptyDocumentTitle')}</strong>
              <span>{t('emptyDocumentMessage')}</span>
              <div>
                <button type="button" onClick={() => void openFileDialog()}>{t('openFile')}</button>
                <button type="button" onClick={() => void openFolder()}>{t('openFolder')}</button>
              </div>
            </div>
          ) : null}
        </main>
      </div>
      <DocumentStatusBar mode={mode} dirty={Boolean(activeDocument?.dirty)} autoSave={Boolean(config?.autoSave)} saveStatus={saveStatus} lineCount={lineCount} characterCount={characterCount} />
      <Toast notices={notices} onClose={(id) => setNotices((current) => current.filter((notice) => notice.id !== id))} />
      {settingsOpen && settingsDraft && config ? <SettingsDialog config={settingsDraft} originalConfig={config} onChange={setSettingsDraft} onApply={applySettings} onClose={closeSettings} /> : null}
      {documentCloseDialogOpen ? (
        <Dialog title={t('closeFile')} role="alertdialog" onBackdropClick={() => setDocumentCloseDialogOpen(false)}>
          <p>{t('closeDocumentMessage')}</p>
          <div className="app-dialog-actions">
            <button type="button" onClick={() => setDocumentCloseDialogOpen(false)}>{t('cancel')}</button>
            <button type="button" onClick={() => void saveAndCloseDocument()}>{t('saveAndClose')}</button>
            <button type="button" className="app-dialog-danger" onClick={removeCurrentDocument}>{t('discardChanges')}</button>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}

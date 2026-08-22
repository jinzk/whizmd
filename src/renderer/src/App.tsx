import { useCallback, useEffect, useState } from 'react'
import { useEditorStore } from './store/editor'
import { WysiwygEditor } from './components/WysiwygEditor'
import { SourceEditor } from './components/SourceEditor'
import { FileSidebar } from './components/FileSidebar'
import { buildExportHtml } from './export/buildHtml'
import { useTheme } from './hooks/useTheme'
import type { AppConfig, MenuCommand } from '@shared/types'
import { useI18n } from './i18n'
import { useDocumentActions } from './hooks/useDocumentActions'
import { AppToolbar } from './components/AppToolbar'
import { DocumentStatusBar } from './components/DocumentStatusBar'
import { SettingsDialog } from './components/SettingsDialog'
import { Dialog } from './components/Dialog'

export function App(): React.JSX.Element {
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const config = useEditorStore((s) => s.config)
  const setConfig = useEditorStore((s) => s.setConfig)
  const theme = useTheme()
  const { t } = useI18n()

  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closeHasUnsavedChanges, setCloseHasUnsavedChanges] = useState(false)
  const [documentCloseDialogOpen, setDocumentCloseDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<AppConfig | null>(null)
  const requestDocumentClose = useCallback(() => setDocumentCloseDialogOpen(true), [])
  const { documents: openedFiles, activeDocumentId, activeDocument, hasUnsavedChanges, rootDir, fileTree, handleUpdate, save, saveStatus, openFile, openFolder, openFileDialog, newFile, selectDocument, closeCurrentDocument, closeDocument, removeCurrentDocument, saveAndCloseDocument } = useDocumentActions(t, requestDocumentClose, () => setDocumentCloseDialogOpen(false))
  const docPath = activeDocument?.path ?? null
  const documentContent = activeDocument?.content ?? ''
  const lineCount = documentContent ? documentContent.split(/\r?\n/).length : 1
  const characterCount = documentContent.length
  useEffect(() => {
    void window.markdownApp.config.get().then(setConfig)
  }, [setConfig])

  useEffect(() => {
    const removeListener = window.markdownApp.window.onCloseRequest(() => {
      setCloseHasUnsavedChanges(hasUnsavedChanges)
      setCloseDialogOpen(true)
    })
    void window.markdownApp.window.readyForCloseRequests()
    return removeListener
  }, [hasUnsavedChanges])

  useEffect(() => {
    const fileName = docPath?.split(/[\\/]/).pop()
    const title = fileName?.replace(/\.(md|markdown|txt)$/i, '') || t('untitledDocument')
    void window.markdownApp.window.setTitle(title)
  }, [docPath, t])

  const openSettings = useCallback((): void => {
    if (!config) return
    setSettingsDraft({ ...config })
    setSettingsOpen(true)
  }, [config])

  const closeSettings = useCallback((): void => {
    setSettingsOpen(false)
    setSettingsDraft(null)
  }, [])

  const applySettings = useCallback(async (): Promise<void> => {
    if (!settingsDraft) return
    const next = await window.markdownApp.config.set(settingsDraft)
    setConfig(next)
    closeSettings()
  }, [closeSettings, setConfig, settingsDraft])

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

  useEffect(() => {
    const actions: Record<MenuCommand, () => void> = {
      'new-file': newFile,
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
  }, [closeCurrentDocument, exportDocument, newFile, openFile, openFileDialog, openFolder, save])

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
      <AppToolbar
        mode={mode}
        docTitle={exportTitle(docPath)}
        dirty={hasUnsavedChanges}
        saveStatus={saveStatus}
        onNew={newFile}
        onSave={() => void save()}
        onModeChange={setMode}
        onSettings={openSettings}
      />

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
          {!activeDocument?.content ? (
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
      <DocumentStatusBar mode={mode} dirty={Boolean(activeDocument?.dirty)} saveStatus={saveStatus} lineCount={lineCount} characterCount={characterCount} />
      {settingsOpen && settingsDraft ? <SettingsDialog config={settingsDraft} onChange={setSettingsDraft} onApply={applySettings} onClose={closeSettings} /> : null}
      {closeDialogOpen ? (
        <Dialog title={t('closeWindow')} titleId="close-dialog-title" role="alertdialog" onBackdropClick={() => setCloseDialogOpen(false)}>
          <p>{t(closeHasUnsavedChanges ? 'closeUnsavedMessage' : 'closeMessage')}</p>
          <div className="app-dialog-actions">
            <button type="button" onClick={() => setCloseDialogOpen(false)}>{t('cancel')}</button>
            <button type="button" className="app-dialog-danger" onClick={() => void window.markdownApp.window.confirmClose()}>{t('continueClose')}</button>
          </div>
        </Dialog>
      ) : null}
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

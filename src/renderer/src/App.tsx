import { useCallback, useEffect, useState } from 'react'
import { useEditorStore } from './store/editor'
import { WysiwygEditor } from './components/WysiwygEditor'
import { SourceEditor } from './components/SourceEditor'
import { FileSidebar } from './components/FileSidebar'
import { buildExportHtml } from './export/buildHtml'
import { useTheme } from './hooks/useTheme'
import type { AppConfig, LanguageMode, MenuCommand, ThemeMode } from '@shared/types'
import { useI18n } from './i18n'
import { useDocumentActions } from './hooks/useDocumentActions'

function ToolbarIcon({ type }: { type: 'new' | 'save' }): React.JSX.Element {
  return type === 'new' ? (
    <svg className="toolbar-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4 2.75h7l4.25 4.25v10.25H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 2.75V7h4.25M10 10v5M7.5 12.5h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg className="toolbar-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3.25 3.25h11l2.5 2.5v11H3.25z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 3.5v5h7v-5M6.25 16.75v-4.5h7.5v4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function SettingsIcon(): React.JSX.Element {
  return (
    <svg className="toolbar-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M8.3 2.8h3.4l.45 1.85c.38.16.74.37 1.06.62l1.8-.63 1.7 2.95-1.35 1.34c.04.22.06.45.06.68s-.02.46-.06.68l1.35 1.34-1.7 2.95-1.8-.63c-.32.25-.68.46-1.06.62l-.45 1.85H8.3l-.45-1.85a5.8 5.8 0 0 1-1.06-.62l-1.8.63-1.7-2.95 1.35-1.34A4 4 0 0 1 4.58 9.6c0-.23.02-.46.06-.68L3.29 7.59l1.7-2.95 1.8.63c.32-.25.68-.46 1.06-.62z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="10" cy="9.6" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

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

  const enterMode = useCallback((target: 'wysiwyg' | 'source'): void => setMode(target), [setMode])

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
      <header className="toolbar">
        <div className="toolbar-left">
          <button type="button" onClick={newFile}>
            <ToolbarIcon type="new" />
            {t('newFile')}
          </button>
          <button type="button" onClick={() => void save()} disabled={saveStatus === 'saving'}>
            <ToolbarIcon type="save" />
            {saveStatus === 'saving' ? t('saving') : t('save')}
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
          <div className="doc-title" title={docPath ?? t('untitledDocument')}>
            {hasUnsavedChanges ? '• ' : ''}{exportTitle(docPath)}
          </div>
          <button type="button" className="toolbar-settings-button" aria-label={t('settings')} title={t('settings')} onClick={openSettings}>
            <SettingsIcon />
          </button>
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
      <footer className="status-bar" aria-label={t('documentStatus')}>
        <span className="status-mode">{mode === 'wysiwyg' ? t('edit') : t('source')}</span>
        <span>{t('lineCount', { count: String(lineCount) })}</span>
        <span>{t('characterCount', { count: String(characterCount) })}</span>
        <span className="status-save" data-status={activeDocument?.dirty ? 'dirty' : saveStatus}>
          {activeDocument?.dirty
            ? t('unsavedChanges')
            : saveStatus === 'saving'
              ? t('saving')
              : saveStatus === 'error'
                ? t('saveError')
                : t('saved')}
        </span>
      </footer>
      {settingsOpen && settingsDraft ? (
        <div className="app-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSettings() }}>
          <div className="app-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <h2 id="settings-title">{t('settings')}</h2>
            <div className="settings-form">
              <label>
                <span>{t('theme')}</span>
                <select value={settingsDraft.themeMode} onChange={(event) => setSettingsDraft({ ...settingsDraft, themeMode: event.target.value as ThemeMode })}>
                  <option value="system">{t('systemTheme')}</option>
                  <option value="light">{t('lightTheme')}</option>
                  <option value="dark">{t('darkTheme')}</option>
                </select>
              </label>
              <label>
                <span>{t('language')}</span>
                <select value={settingsDraft.language} onChange={(event) => setSettingsDraft({ ...settingsDraft, language: event.target.value as LanguageMode })}>
                  <option value="system">{t('system')}</option>
                  <option value="zh-CN">{t('chinese')}</option>
                  <option value="en-US">{t('english')}</option>
                </select>
              </label>
              <label>
                <span>{t('assetsDirectory')}</span>
                <input value={settingsDraft.assetsDir} onChange={(event) => setSettingsDraft({ ...settingsDraft, assetsDir: event.target.value })} placeholder="assets" />
                <small>{t('assetsDirectoryHint')}</small>
              </label>
              <label>
                <span>{t('imagePathStrategy')}</span>
                <select value={settingsDraft.imagePathStrategy} onChange={(event) => setSettingsDraft({ ...settingsDraft, imagePathStrategy: event.target.value as AppConfig['imagePathStrategy'] })}>
                  <option value="relative">{t('relativePath')}</option>
                  <option value="absolute">{t('absolutePath')}</option>
                </select>
              </label>
            </div>
            <div className="app-dialog-actions">
              <button type="button" onClick={closeSettings}>{t('cancel')}</button>
              <button type="button" className="app-dialog-primary" onClick={() => void applySettings()}>{t('apply')}</button>
            </div>
          </div>
        </div>
      ) : null}
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

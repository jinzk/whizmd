import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from './store/editor'
import { WysiwygEditor } from './components/WysiwygEditor'
import { SourceEditor } from './components/SourceEditor'
import { FileSidebar } from './components/FileSidebar'
import { buildExportHtml } from './export/buildHtml'
import { useTheme } from './hooks/useTheme'
import type { ThemeMode } from '@shared/types'
import type { LanguageMode, MenuCommand } from '@shared/types'
import { useI18n } from './i18n'
import { useDocumentActions } from './hooks/useDocumentActions'

const THEME_CYCLE: ThemeMode[] = ['system', 'light', 'dark']

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

export function App(): React.JSX.Element {
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const config = useEditorStore((s) => s.config)
  const setConfig = useEditorStore((s) => s.setConfig)
  const theme = useTheme()
  const { t } = useI18n()

  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closeHasUnsavedChanges, setCloseHasUnsavedChanges] = useState(false)
  const [documentCloseDialogOpen, setDocumentCloseDialogOpen] = useState(false)
  const requestDocumentClose = useCallback(() => setDocumentCloseDialogOpen(true), [])
  const { documents: openedFiles, activeDocumentId, activeDocument, hasUnsavedChanges, rootDir, fileTree, handleUpdate, save, openFile, openFolder, openFileDialog, newFile, selectDocument, closeCurrentDocument, removeCurrentDocument, saveAndCloseDocument } = useDocumentActions(t, requestDocumentClose, () => setDocumentCloseDialogOpen(false))
  const docPath = activeDocument?.path ?? null
  const languageMenuRef = useRef<HTMLDivElement>(null)
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
          <button type="button" onClick={() => void save()}>
            <ToolbarIcon type="save" />
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

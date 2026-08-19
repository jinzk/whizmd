import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileNode } from '@shared/types'
import { useEditorStore } from './store/editor'
import { WysiwygEditor } from './components/WysiwygEditor'
import { SourceEditor } from './components/SourceEditor'
import { FileSidebar } from './components/FileSidebar'
import { insertImageFromDialog } from './editor/image/insert'
import { buildExportHtml } from './export/buildHtml'
import { useTheme } from './hooks/useTheme'
import type { ThemeMode } from '@shared/types'
import { TextSelection } from '@tiptap/pm/state'

const THEME_CYCLE: ThemeMode[] = ['system', 'light', 'dark']

export function App(): React.JSX.Element {
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const docPath = useEditorStore((s) => s.docPath)
  const setDocPath = useEditorStore((s) => s.setDocPath)
  const setDirty = useEditorStore((s) => s.setDirty)
  const config = useEditorStore((s) => s.config)
  const setConfig = useEditorStore((s) => s.setConfig)

  const theme = useTheme()

  // Markdown loaded from disk or swapped in from the other editor. Editing does
  // NOT mutate this (see handleUpdate), so typing never re-renders the tree.
  const [externalContent, setExternalContent] = useState('')
  const [rootDir, setRootDir] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const saveInFlightRef = useRef<Promise<void> | null>(null)
  const sourceInsertRef = useRef<((text: string) => void) | null>(null)

  const tableCommand = useCallback(
    (command: (editor: NonNullable<ReturnType<typeof useEditorStore.getState>['editor']>) => void) => {
      const editor = useEditorStore.getState().editor
      if (editor && mode === 'wysiwyg') command(editor)
    },
    [mode]
  )

  const confirmDiscardChanges = useCallback((): boolean => {
    if (!useEditorStore.getState().dirty) {
      return true
    }
    return window.confirm('当前文档有未保存的修改，确定要放弃吗？')
  }, [])

  useEffect(() => {
    void window.markdownApp.config.get().then(setConfig)
  }, [setConfig])

  // Keep the store's markdown mirror current during editing WITHOUT triggering
  // any React re-render (nothing subscribes to `content` reactively).
  const handleUpdate = useMemo(
    () => (md: string) => {
      useEditorStore.getState().setContent(md)
      setDirty(true)
    },
    [setDirty]
  )

  // Capture the latest markdown into `externalContent` before swapping editors
  // so the newly mounted editor initializes with up-to-date text. Reading from
  // the editor instance keeps it correct even if the debounced store mirror is
  // slightly behind.
  const enterMode = useMemo(
    () => (target: 'wysiwyg' | 'source') => {
      const store = useEditorStore.getState()
      setExternalContent(store.editor?.getMarkdown() ?? store.content)
      setMode(target)
    },
    [setMode]
  )

  const save = useCallback(async (): Promise<void> => {
    if (saveInFlightRef.current) {
      await saveInFlightRef.current
      return
    }

    const operation = (async (): Promise<void> => {
      const store = useEditorStore.getState()
      const sourcePath = store.docPath
      const current = store.editor?.getMarkdown() ?? store.content
      let target = sourcePath
      if (!target) {
        target = await window.markdownApp.file.saveFileDialog('untitled.md')
        if (!target) {
          return
        }
        setDocPath(target)
      }
      await window.markdownApp.file.write(target, current)
      const latest = useEditorStore.getState()
      if (latest.docPath === target) {
        setDirty(false)
      }
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
      window.alert(`保存失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      if (saveInFlightRef.current === operation) {
        saveInFlightRef.current = null
      }
    }
  }, [rootDir, setDocPath, setDirty])

  const openFile = useCallback(
    async (path: string) => {
      if (!confirmDiscardChanges()) {
        return
      }
      try {
        const text = await window.markdownApp.file.read(path)
        setExternalContent(text)
        useEditorStore.getState().setContent(text)
        setDocPath(path)
        setDirty(false)
      } catch (error) {
        console.error('Failed to open document', error)
        window.alert(`打开失败：${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [confirmDiscardChanges, setDocPath, setDirty]
  )

  const openFolder = useCallback(async () => {
    if (!confirmDiscardChanges()) {
      return
    }
    const dir = await window.markdownApp.file.openDirectoryDialog()
    if (!dir) {
      return
    }
    const tree = await window.markdownApp.dir.scan(dir)
    setRootDir(dir)
    setFileTree(tree)
  }, [confirmDiscardChanges])

  const openFileDialog = useCallback(async () => {
    const path = await window.markdownApp.file.openDialog()
    if (path) {
      await openFile(path)
    }
  }, [openFile])

  const newFile = useCallback(() => {
    if (!confirmDiscardChanges()) {
      return
    }
    setExternalContent('')
    useEditorStore.getState().setContent('')
    setDocPath(null)
    setDirty(false)
  }, [confirmDiscardChanges, setDocPath, setDirty])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (useEditorStore.getState().dirty) {
        // Let Electron's will-prevent-unload handler show the native dialog.
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const exportTitle = useCallback((path: string | null): string => {
    if (!path) {
      return 'untitled'
    }
    const base = path.split(/[\\/]/).pop() ?? 'untitled'
    return base.replace(/\.(md|markdown|txt)$/i, '') || 'untitled'
  }, [])

  const exportDefaultPath = useCallback((path: string | null, ext: 'html' | 'pdf'): string => {
    if (!path) {
      return `untitled.${ext}`
    }
    return path.replace(/\.(md|markdown|txt)$/i, '') + `.${ext}`
  }, [])

  const exportDocument = useCallback(
    async (kind: 'html' | 'pdf') => {
      const path = useEditorStore.getState().docPath
      const md =
        useEditorStore.getState().editor?.getMarkdown() ??
        useEditorStore.getState().content
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
    [exportDefaultPath, exportTitle]
  )

  const insertMermaid = useCallback((): void => {
    if (mode === 'source') {
      sourceInsertRef.current?.('```mermaid\n\n```')
      return
    }

    const editor = useEditorStore.getState().editor
    if (!editor) {
      return
    }
    const { state } = editor
    const { $from } = state.selection
    const insertPos = state.doc.childCount === 0 ? 0 : $from.depth > 0 ? $from.after(1) : 0
    const codeBlock = state.schema.nodes.codeBlock.create({ language: 'mermaid' })
    const transaction = state.tr.insert(insertPos, codeBlock)
    transaction.setSelection(TextSelection.create(transaction.doc, insertPos + 1))
    editor.view.dispatch(transaction)
    editor.commands.focus()
  }, [mode])
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
            新建
          </button>
          <button type="button" onClick={openFolder}>
            打开文件夹
          </button>
          <button type="button" onClick={openFileDialog}>
            打开文件
          </button>
          <button type="button" onClick={() => void save()}>
            保存
          </button>
          <span className="toolbar-sep" />
          <button
            type="button"
            className={mode === 'wysiwyg' ? 'active' : ''}
            onClick={() => enterMode('wysiwyg')}
          >
            所见即所得
          </button>
          <button
            type="button"
            className={mode === 'source' ? 'active' : ''}
            onClick={() => enterMode('source')}
          >
            源码
          </button>
          <button
            type="button"
            onClick={() => {
              const editor = useEditorStore.getState().editor
              if (editor) {
                void insertImageFromDialog(editor)
              }
            }}
          >
            插入图片
          </button>
           <button
             type="button"
             disabled={mode !== 'wysiwyg'}
            onClick={() => {
              useEditorStore
                .getState()
                .editor?.chain()
                .focus()
                .setCodeBlock({ language: 'plaintext' })
                .run()
            }}
          >
             插入代码块
           </button>
           <button
             type="button"
             disabled={mode !== 'wysiwyg'}
             onClick={() =>
               tableCommand((editor) =>
                 editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
               )
             }
           >
             插入表格
           </button>
          <button
            type="button"
            onClick={() => {
              insertMermaid()
            }}
          >
            插入 Mermaid
          </button>
          <button type="button" onClick={() => void exportDocument('html')}>
            导出 HTML
          </button>
          <button type="button" onClick={() => void exportDocument('pdf')}>
            导出 PDF
          </button>
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
            title="切换主题"
          >
            {config?.themeMode ?? 'system'} 主题
          </button>
          <span className="doc-title">{docPath ?? '未命名文档'}</span>
        </div>
      </header>

      <div className="main-layout">
        <FileSidebar
          root={fileTree}
          rootDir={rootDir}
          activePath={docPath}
          onOpenFile={(p) => void openFile(p)}
        />
        <main className="editor-area">
          {mode === 'wysiwyg' ? (
            <WysiwygEditor content={externalContent} onUpdate={handleUpdate} />
          ) : (
            <SourceEditor
              content={externalContent}
              onUpdate={handleUpdate}
              theme={theme}
              registerInsert={(insert) => {
                sourceInsertRef.current = insert
              }}
            />
          )}
        </main>
      </div>
    </div>
  )
}

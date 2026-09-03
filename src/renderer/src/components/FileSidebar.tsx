import { useEffect, useState } from 'react'
import type { FileNode } from '@shared/types'
import { useI18n } from '../i18n'
import { OutlinePanel } from './OutlinePanel'

interface Props {
  root: FileNode | null
  rootDir: string | null
  activePath: string | null
  activeDocumentId: string
  openedFiles: Array<{ id: string; path: string | null; dirty: boolean }>
  onOpenFile: (path: string) => void
  onSelectDocument: (id: string) => void
  onCloseDocument: (id: string) => void
  onRefresh: () => void
  showMarkdownOnly: boolean
  onToggleMarkdownOnly: () => void
  treeStatus: 'idle' | 'loading' | 'error'
  recentFiles: string[]
  recentFolders: string[]
  onOpenRecent: (path: string) => void
  onOpenRecentFolder: (path: string) => void
  onRemoveRecent: (path: string) => void
  onRemoveRecentFolder: (path: string) => void
  onClearRecent: () => void
  content: string
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function TreeNode({
  node,
  depth,
  activePath,
  onOpenFile,
  expandedPaths,
  onToggleDirectory
}: {
  node: FileNode
  depth: number
  activePath: string | null
  onOpenFile: (path: string) => void
  expandedPaths: Set<string>
  onToggleDirectory: (path: string) => void
}): React.JSX.Element {
  const expanded = expandedPaths.has(node.path)

  if (!node.isDirectory) {
    const active = node.path === activePath
    return (
      <button
        type="button"
        className={`file-item ${active ? 'active' : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onOpenFile(node.path)}
      >
        {node.name}
      </button>
    )
  }

  return (
    <div className="dir-item">
      <button
        type="button"
        className="dir-label"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onToggleDirectory(node.path)}
      >
        <span className={`dir-arrow ${expanded ? 'open' : ''}`}>▸</span>
        {node.name}
      </button>
      {expanded
        ? node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onOpenFile={onOpenFile}
              expandedPaths={expandedPaths}
              onToggleDirectory={onToggleDirectory}
            />
          ))
        : null}
    </div>
  )
}

export function FileSidebar({
  root,
  rootDir,
  activePath,
  activeDocumentId,
  openedFiles,
  onOpenFile,
  onSelectDocument,
  onCloseDocument, onRefresh, showMarkdownOnly, onToggleMarkdownOnly, treeStatus, recentFiles, recentFolders, onOpenRecent, onOpenRecentFolder, onRemoveRecent, onRemoveRecentFolder, onClearRecent, content
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'file' | 'outline'>('file')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(root ? [root.path] : []))
  const toggleDirectory = (path: string): void => setExpandedPaths((current) => {
    const next = new Set(current)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    return next
  })
  useEffect(() => {
    if (!root) return
    try {
      const saved = JSON.parse(localStorage.getItem('whizmd.expandedDirectories') ?? '[]')
      // The persisted tree state is external state synchronized on root changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setExpandedPaths(new Set(saved.filter((path): path is string => typeof path === 'string')))
    } catch {
      setExpandedPaths(new Set([root.path]))
    }
  }, [root])
  useEffect(() => {
    localStorage.setItem('whizmd.expandedDirectories', JSON.stringify([...expandedPaths]))
  }, [expandedPaths])
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'file'}
          className={`sidebar-tab ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          {t('fileTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'outline'}
          className={`sidebar-tab ${activeTab === 'outline' ? 'active' : ''}`}
          onClick={() => setActiveTab('outline')}
        >
          {t('outlineTab')}
        </button>
      </div>
      {activeTab === 'file' ? (
        <div className="sidebar-file-panel">
          <section className="sidebar-section sidebar-open-files">
            <div className="sidebar-section-title">{t('openedFiles')}</div>
            {openedFiles.length > 0 ? (
              openedFiles.map((file) => {
                const active = file.id === activeDocumentId
                const label = file.path ? fileName(file.path) : t('untitledDocument')
                return (
                  <div key={file.id} className={`file-row ${active ? 'active' : ''}`}>
                    <button
                      type="button"
                      className="file-item"
                      onClick={() => {
                        if (file.path) onOpenFile(file.path)
                        else onSelectDocument(file.id)
                      }}
                      title={label}
                    >
                      {file.dirty ? <span className="file-dirty" aria-label={t('unsavedChanges')}>●</span> : null}
                      {label}
                    </button>
                    <button
                      type="button"
                      className="file-close"
                      aria-label={`${t('closeFile')}: ${label}`}
                      title={t('closeFile')}
                      onClick={() => {
                        onCloseDocument(file.id)
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              })
            ) : (
              <p className="sidebar-empty">{t('noOpenFiles')}</p>
            )}
          </section>
          {recentFiles.length > 0 ? <section className="sidebar-section">
            <div className="sidebar-section-title sidebar-section-heading"><span>{t('recentFiles')}</span><button type="button" className="sidebar-tool" onClick={onClearRecent}>{t('clear')}</button></div>
            {recentFiles.map((path) => <div key={path} className="file-row"><button type="button" className="file-item" title={path} onClick={() => onOpenRecent(path)}>{fileName(path)}</button><button type="button" className="file-close recent-remove" aria-label={`${t('removeRecent')}: ${fileName(path)}`} onClick={() => onRemoveRecent(path)}>×</button></div>)}
            {recentFolders.map((path) => <div key={path} className="file-row"><button type="button" className="file-item" title={path} onClick={() => onOpenRecentFolder(path)}>Folder: {fileName(path)}</button><button type="button" className="file-close recent-remove" aria-label={`${t('removeRecent')}: ${fileName(path)}`} onClick={() => onRemoveRecentFolder(path)}>×</button></div>)}
          </section> : null}
          {rootDir ? (
            <section className="sidebar-section sidebar-folder-tree">
              <div className="sidebar-section-title sidebar-section-heading"><span>{t('folder')}</span><span><button type="button" className="sidebar-tool" title={t('refresh')} aria-label={t('refresh')} onClick={onRefresh}>↻</button><button type="button" className="sidebar-tool" title={t('toggleMarkdownOnly')} aria-label={t('toggleMarkdownOnly')} onClick={onToggleMarkdownOnly}>{showMarkdownOnly ? 'MD' : 'ALL'}</button></span></div>
              <div className="sidebar-header" title={rootDir}>{rootDir}</div>
              {treeStatus === 'loading' ? <p className="sidebar-empty">{t('loading')}</p> : treeStatus === 'error' ? <p className="sidebar-empty settings-error">{t('folderScanFailed')}</p> : root ? (
                <TreeNode node={root} depth={0} activePath={activePath} onOpenFile={onOpenFile} expandedPaths={expandedPaths} onToggleDirectory={toggleDirectory} />
              ) : <p className="sidebar-empty">{t('emptyFolder')}</p>}
            </section>
          ) : null}
        </div>
      ) : (
        <div className="sidebar-outline-panel">
          <OutlinePanel content={content} />
        </div>
      )}
    </aside>
  )
}

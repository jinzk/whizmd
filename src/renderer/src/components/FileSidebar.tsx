import { useState } from 'react'
import type { FileNode } from '@shared/types'
import { useI18n } from '../i18n'

interface Props {
  root: FileNode | null
  rootDir: string | null
  activePath: string | null
  activeDocumentId: string
  openedFiles: Array<{ id: string; path: string | null; dirty: boolean }>
  onOpenFile: (path: string) => void
  onSelectDocument: (id: string) => void
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function TreeNode({
  node,
  depth,
  activePath,
  onOpenFile
}: {
  node: FileNode
  depth: number
  activePath: string | null
  onOpenFile: (path: string) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(depth === 0)

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
        onClick={() => setExpanded((e) => !e)}
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
  onSelectDocument
}: Props): React.JSX.Element {
  const { t } = useI18n()
  return (
    <aside className="sidebar">
      <section className="sidebar-section sidebar-open-files">
        <div className="sidebar-section-title">{t('openedFiles')}</div>
        {openedFiles.length > 0 ? (
          openedFiles.map((file) => {
            const active = file.id === activeDocumentId
            const label = file.path ? fileName(file.path) : t('untitledDocument')
            return (
              <button
                key={file.id}
                type="button"
                className={`file-item ${active ? 'active' : ''}`}
                onClick={() => {
                  if (file.path) {
                    onOpenFile(file.path)
                  } else {
                    onSelectDocument(file.id)
                  }
                }}
              >
                {file.dirty ? '*' : ''}
                {label}
              </button>
            )
          })
        ) : (
          <p className="sidebar-empty">{t('noOpenFiles')}</p>
        )}
      </section>
      {rootDir ? (
        <section className="sidebar-section sidebar-folder-tree">
          <div className="sidebar-section-title">{t('folder')}</div>
          <div className="sidebar-header">{rootDir}</div>
          {root ? (
            <TreeNode node={root} depth={0} activePath={activePath} onOpenFile={onOpenFile} />
          ) : null}
        </section>
      ) : null}
    </aside>
  )
}

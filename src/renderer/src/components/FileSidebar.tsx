import { useState } from 'react'
import type { FileNode } from '@shared/types'
import { useI18n } from '../i18n'

interface Props {
  root: FileNode | null
  rootDir: string | null
  activePath: string | null
  onOpenFile: (path: string) => void
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

export function FileSidebar({ root, rootDir, activePath, onOpenFile }: Props): React.JSX.Element {
  const { t } = useI18n()
  return (
    <aside className="sidebar">
      {rootDir ? <div className="sidebar-header">{rootDir}</div> : null}
      {root ? (
        <TreeNode node={root} depth={0} activePath={activePath} onOpenFile={onOpenFile} />
      ) : (
        <p className="sidebar-empty">{t('noFolder')}</p>
      )}
    </aside>
  )
}

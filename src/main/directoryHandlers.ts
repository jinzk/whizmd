import { ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { IpcChannels } from '../shared/ipc'
import type { DirectoryScanResult, FileNode } from '../shared/types'

const SKIPPED_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '.idea', '.vscode', 'dist', 'out'])
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])
const MAX_SCAN_DEPTH = 8

type DirectoryHandlerOptions = {
  isAllowedFile: (filePath: string) => boolean
}

export function registerDirectoryHandlers({ isAllowedFile }: DirectoryHandlerOptions): void {
  const cancelledScans = new Set<string>()
  ipcMain.on(IpcChannels.dirScanCancel, (_event, requestId: unknown) => {
    if (typeof requestId === 'string') cancelledScans.add(requestId)
  })
  ipcMain.handle(IpcChannels.dirScan, async (_e, dirPath: string, markdownOnly = true, requestId?: string): Promise<DirectoryScanResult> => {
    if (typeof dirPath !== 'string') return { status: 'error', message: 'Invalid directory path' }
    if (!isAllowedFile(dirPath)) return { status: 'error', message: 'Directory was not selected by the user' }
    const tree = await scanDirectory(dirPath, 0, markdownOnly, requestId, cancelledScans)
    if (requestId) cancelledScans.delete(requestId)
    if (!tree) return { status: 'error', message: 'Unable to scan directory' }
    return { status: tree.children.length ? 'success' : 'empty', tree }
  })
}

async function scanDirectory(dirPath: string, depth: number, markdownOnly: boolean, requestId: string | undefined, cancelledScans: Set<string>): Promise<FileNode | null> {
  let entries
  try { entries = await fs.readdir(dirPath, { withFileTypes: true }) } catch { return null }
  const children: FileNode[] = []
  for (const entry of entries) {
    if (requestId && cancelledScans.has(requestId)) return null
    if (entry.name.startsWith('.')) continue
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name) || depth >= MAX_SCAN_DEPTH) continue
      const node = await scanDirectory(fullPath, depth + 1, markdownOnly, requestId, cancelledScans)
      if (node && node.children.length > 0) children.push(node)
    } else if (entry.isFile() && (!markdownOnly || MARKDOWN_EXTENSIONS.has(extname(entry.name).toLowerCase()))) {
      children.push({ name: entry.name, path: fullPath, isDirectory: false, children: [] })
    }
  }
  children.sort((a, b) => a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return { name: basename(dirPath), path: dirPath, isDirectory: true, children }
}

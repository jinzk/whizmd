import { useCallback, useRef, useState } from 'react'
import type { FileNode } from '@shared/types'

export function useFileOperations(openFile: (path: string) => Promise<void>, markdownOnly = true) {
  const [rootDir, setRootDir] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [treeStatus, setTreeStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const scanRequestRef = useRef(0)
  const activeScanIdRef = useRef<string | null>(null)

  const beginScan = (): string => {
    if (activeScanIdRef.current) window.markdownApp.dir.cancelScan(activeScanIdRef.current)
    const id = `scan-${Date.now()}-${++scanRequestRef.current}`
    activeScanIdRef.current = id
    return id
  }

  const refresh = useCallback(async (): Promise<void> => {
    if (!rootDir) return
    const requestId = beginScan()
    setTreeStatus('loading')
    try { const result = await window.markdownApp.dir.scan(rootDir, markdownOnly, requestId); if (requestId !== activeScanIdRef.current) return; setFileTree('tree' in result ? result.tree : null); setTreeStatus(result.status === 'error' ? 'error' : 'idle') } catch { if (requestId === activeScanIdRef.current) setTreeStatus('error') }
  }, [markdownOnly, rootDir])

  const openFolder = useCallback(async (): Promise<void> => {
    const directory = await window.markdownApp.file.openDirectoryDialog()
    if (!directory) return
    setRootDir(directory)
    void window.markdownApp.recent?.addFolder(directory)
    const requestId = beginScan()
    setTreeStatus('loading')
    try { const result = await window.markdownApp.dir.scan(directory, markdownOnly, requestId); if (requestId !== activeScanIdRef.current) return; setFileTree('tree' in result ? result.tree : null); setTreeStatus(result.status === 'error' ? 'error' : 'idle') } catch { if (requestId === activeScanIdRef.current) setTreeStatus('error') }
  }, [markdownOnly])

  const openFolderPath = useCallback(async (directory: string): Promise<void> => {
    setRootDir(directory)
    const requestId = beginScan()
    setTreeStatus('loading')
    try { const result = await window.markdownApp.dir.scan(directory, markdownOnly, requestId); if (requestId !== activeScanIdRef.current) return; setFileTree('tree' in result ? result.tree : null); setTreeStatus(result.status === 'error' ? 'error' : 'idle') } catch { if (requestId === activeScanIdRef.current) setTreeStatus('error') }
  }, [markdownOnly])

  const openFileDialog = useCallback(async (): Promise<void> => {
    const path = await window.markdownApp.file.openDialog()
    if (path) await openFile(path)
  }, [openFile])

  return { rootDir, fileTree, setFileTree, treeStatus, openFolder, openFolderPath, openFileDialog, refresh }
}

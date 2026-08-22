import { useCallback, useState } from 'react'
import type { FileNode } from '@shared/types'

export function useFileOperations(openFile: (path: string) => Promise<void>) {
  const [rootDir, setRootDir] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode | null>(null)

  const openFolder = useCallback(async (): Promise<void> => {
    const directory = await window.markdownApp.file.openDirectoryDialog()
    if (!directory) return
    setRootDir(directory)
    setFileTree(await window.markdownApp.dir.scan(directory))
  }, [])

  const openFileDialog = useCallback(async (): Promise<void> => {
    const path = await window.markdownApp.file.openDialog()
    if (path) await openFile(path)
  }, [openFile])

  return { rootDir, fileTree, setFileTree, openFolder, openFileDialog }
}

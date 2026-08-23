import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { promises as fs, existsSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { IpcChannels } from '../shared/ipc'
import type { AppConfig, FileNode, ExportPayload, ImportImageResult, DirectoryScanResult } from '../shared/types'
import { addRecentFile, addRecentFolder, clearRecent, getRecent, removeRecentFile, removeRecentFolder } from './recentFiles'
import { allowMediaDirectory, allowMediaFile } from './protocol'
import { rebuildApplicationMenu } from './menu'
import { setMainWindowDirty, setMainWindowLanguage } from './window'
import { prepareImages } from './imageMigration'
import { isSupportedImageName, sanitizeFileName, uniqueImageName } from './fileImages'
import { readTextFile, writeTextFile } from './fileService'
import { dialogLanguage, getConfig, setConfig } from './configService'

const SKIPPED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.idea',
  '.vscode',
  'dist',
  'out'
])
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])
const MAX_SCAN_DEPTH = 8
const allowedFileRoots = new Set<string>()
const allowedFiles = new Set<string>()
const cancelledScans = new Set<string>()

function normalizedPath(filePath: string): string {
  return resolve(filePath).toLowerCase()
}


function allowFile(filePath: string): void {
  allowedFiles.add(normalizedPath(filePath))
}

function allowDirectory(dirPath: string): void {
  const normalized = normalizedPath(dirPath)
  allowedFileRoots.add(normalized)
  allowMediaDirectory(dirPath)
}

function isAllowedFile(filePath: string): boolean {
  const normalized = normalizedPath(filePath)
  return (
    allowedFiles.has(normalized) ||
    [...allowedFileRoots].some(
      (root) => normalized === root || normalized.startsWith(`${root}${sep}`)
    )
  )
}

async function helpDocumentPath(): Promise<string | null> {
  const chinese = (await dialogLanguage()) === 'zh-CN'
  const filePath = join(app.getAppPath(), chinese ? 'HELP_CN.md' : 'HELP.md')
  if (!existsSync(filePath)) return null
  allowFile(filePath)
  allowDirectory(dirname(filePath))
  return filePath
}


export function registerIpcHandlers(): void {
  ipcMain.on(IpcChannels.mediaAllow, (event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !filePath.trim() || !existsSync(filePath)) {
      event.returnValue = false
      return
    }
    allowMediaFile(filePath)
    event.returnValue = true
  })

  ipcMain.handle(IpcChannels.appConfigGet, () => getConfig())
  ipcMain.handle(IpcChannels.recentList, () => getRecent())
  ipcMain.handle(IpcChannels.recentAdd, (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('Invalid recent file')
    return addRecentFile(filePath)
  })
  ipcMain.handle(IpcChannels.recentClear, async () => {
    return clearRecent()
  })
  ipcMain.handle(IpcChannels.recentRemove, (_event, filePath: unknown) => {
    if (typeof filePath !== 'string') throw new Error('Invalid recent file')
    return removeRecentFile(filePath)
  })
  ipcMain.handle(IpcChannels.recentRemoveFolder, (_event, folderPath: unknown) => {
    if (typeof folderPath !== 'string') throw new Error('Invalid recent folder')
    return removeRecentFolder(folderPath)
  })
  ipcMain.handle(IpcChannels.recentAddFolder, (_event, folderPath: unknown) => {
    if (typeof folderPath !== 'string' || !folderPath.trim()) throw new Error('Invalid recent folder')
    return addRecentFolder(folderPath)
  })
  ipcMain.handle(IpcChannels.helpOpen, () => helpDocumentPath())
  ipcMain.handle(IpcChannels.appConfigSet, async (_e, patch: Partial<AppConfig>) => {
    const config = await setConfig(patch)
    await rebuildApplicationMenu(
      config.language === 'zh-CN' ||
        (config.language === 'system' && /^zh(?:-|$)/i.test(app.getLocale()))
    )
    return config
  })
  ipcMain.handle(IpcChannels.windowSetTitle, (event, title: unknown) => {
    if (typeof title !== 'string' || title.length > 512) {
      throw new Error('Invalid window title')
    }
    BrowserWindow.fromWebContents(event.sender)?.setTitle(`${title} - WhizMD`)
  })
  ipcMain.handle(IpcChannels.windowSetDirty, (event, dirty: unknown) => {
    if (typeof dirty !== 'boolean') throw new Error('Invalid dirty state')
    setMainWindowDirty(BrowserWindow.fromWebContents(event.sender), dirty)
  })
  ipcMain.handle(IpcChannels.windowSetLanguage, (event, language: unknown) => {
    if (language !== 'system' && language !== 'zh-CN' && language !== 'en-US') throw new Error('Invalid language')
    setMainWindowLanguage(BrowserWindow.fromWebContents(event.sender), language)
  })
  ipcMain.handle(IpcChannels.dialogOpenFile, async () => {
    const chinese = (await dialogLanguage()) === 'zh-CN'
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: chinese ? 'Markdown 文件' : 'Markdown', extensions: ['md', 'markdown', 'txt'] },
        { name: chinese ? '所有文件' : 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    allowFile(result.filePaths[0])
    allowDirectory(dirname(result.filePaths[0]))
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannels.dialogOpenImage, async () => {
    const chinese = (await dialogLanguage()) === 'zh-CN'
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: chinese ? '图片' : 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif']
        },
        { name: chinese ? '所有文件' : 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    allowFile(result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannels.fileRead, async (_e, filePath: string) => {
    if (typeof filePath !== 'string') {
      throw new Error('fileRead requires a string path')
    }
    if (!filePath.trim()) {
      throw new Error('fileRead requires a non-empty path')
    }
    if (!isAllowedFile(filePath)) {
      throw new Error('fileRead path was not selected by the user')
    }
    return readTextFile(filePath)
  })
  ipcMain.handle(IpcChannels.fileOpenRecent, async (_e, filePath: string) => {
    if (typeof filePath !== 'string' || !filePath.trim() || !existsSync(filePath)) throw new Error('Recent file does not exist')
    allowFile(filePath)
    allowDirectory(dirname(filePath))
    return readTextFile(filePath)
  })

  ipcMain.handle(IpcChannels.fileWrite, async (_e, filePath: string, content: string) => {
    if (typeof filePath !== 'string') {
      throw new Error('fileWrite requires a string path')
    }
    if (typeof content !== 'string' || !filePath.trim()) {
      throw new Error('fileWrite requires a path and string content')
    }
    if (!isAllowedFile(filePath)) {
      throw new Error('fileWrite path was not selected by the user')
    }
    return writeTextFile(filePath, content)
  })

  ipcMain.handle(
    IpcChannels.fileImportImage,
    async (_e, sourcePath: string, docPath: string | null): Promise<ImportImageResult> => {
      if (typeof sourcePath !== 'string') {
        throw new Error('fileImportImage requires a string source path')
      }
      const config = await getConfig()
      const fileName = sanitizeFileName(basename(sourcePath))
      if (!isSupportedImageName(fileName)) {
        throw new Error('Unsupported image type')
      }
      allowFile(sourcePath)
      if (docPath && !isAllowedFile(docPath)) {
        throw new Error('Document path was not selected by the user')
      }

      if (!docPath || config.imagePathStrategy === 'absolute') {
        // Untitled doc / absolute strategy: copy into the app's asset library
        // so the image is referenced by a stable media:// URL instead of an
        // inline base64 blob that would bloat the markdown text.
        const assetsDir = resolve(app.getPath('userData'), config.assetsDir)
        const target = join(assetsDir, uniqueImageName(assetsDir, fileName))
        await fs.mkdir(assetsDir, { recursive: true })
        allowMediaDirectory(assetsDir)
        await fs.copyFile(sourcePath, target)
        return { markdownPath: target, absolutePath: target }
      }

      const assetsDir = resolve(dirname(docPath), config.assetsDir)
       const target = join(assetsDir, uniqueImageName(assetsDir, fileName))
      await fs.mkdir(assetsDir, { recursive: true })
      allowMediaDirectory(dirname(docPath))
      await fs.copyFile(sourcePath, target)

      return {
        markdownPath: relative(dirname(docPath), target),
        absolutePath: target
      }
    }
  )

  ipcMain.handle(IpcChannels.filePrepareImages, async (_e, content: string, docPath: string): Promise<string> => {
    if (typeof content !== 'string' || typeof docPath !== 'string' || !isAllowedFile(docPath)) return content
    return prepareImages(content, docPath, { allowMediaDirectory })
  })

  ipcMain.handle(
    IpcChannels.fileSaveImageBlob,
    async (
      _e,
      payload: { data: Uint8Array; name: string },
      docPath: string | null
    ): Promise<ImportImageResult> => {
      if (
        !payload ||
        !(payload.data instanceof Uint8Array) ||
        typeof payload.name !== 'string' ||
        payload.data.byteLength === 0
      ) {
        throw new Error('Invalid image payload')
      }
      const config = await getConfig()
      const fileName = sanitizeFileName(payload.name)
      if (!isSupportedImageName(fileName)) {
        throw new Error('Unsupported image type')
      }
      if (docPath && !isAllowedFile(docPath)) {
        throw new Error('Document path was not selected by the user')
      }
      if (!docPath || config.imagePathStrategy === 'absolute') {
        const assetsDir = resolve(app.getPath('userData'), config.assetsDir)
        const target = join(assetsDir, uniqueImageName(assetsDir, fileName))
        await fs.mkdir(assetsDir, { recursive: true })
        allowMediaDirectory(assetsDir)
        await fs.writeFile(target, Buffer.from(payload.data))
        return { markdownPath: target, absolutePath: target }
      }
      const assetsDir = resolve(dirname(docPath), config.assetsDir)
       const target = join(assetsDir, uniqueImageName(assetsDir, fileName))
      await fs.mkdir(assetsDir, { recursive: true })
      allowMediaDirectory(dirname(docPath))
      await fs.writeFile(target, Buffer.from(payload.data))
      return {
        markdownPath: relative(dirname(docPath), target),
        absolutePath: target
      }
    }
  )

  ipcMain.handle(IpcChannels.dialogOpenDirectory, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    allowDirectory(result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannels.dialogSaveFile, async (_e, defaultPath?: string) => {
    const chinese = (await dialogLanguage()) === 'zh-CN'
    const result = await dialog.showSaveDialog({
      title: chinese ? '保存 Markdown' : 'Save Markdown',
      defaultPath,
      filters: [
        { name: chinese ? 'Markdown 文件' : 'Markdown', extensions: ['md'] },
        { name: chinese ? '所有文件' : 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    allowFile(result.filePath)
    return result.filePath
  })

  ipcMain.on(IpcChannels.dirScanCancel, (_event, requestId: unknown) => {
    if (typeof requestId === 'string') cancelledScans.add(requestId)
  })
  ipcMain.handle(IpcChannels.dirScan, async (_e, dirPath: string, markdownOnly = true, requestId?: string): Promise<DirectoryScanResult> => {
    if (typeof dirPath !== 'string') {
      return { status: 'error', message: 'Invalid directory path' }
    }
    if (!isAllowedFile(dirPath)) {
      return { status: 'error', message: 'Directory was not selected by the user' }
    }
    const tree = await scanDirectory(dirPath, 0, markdownOnly, requestId)
    if (requestId) cancelledScans.delete(requestId)
    if (!tree) return { status: 'error', message: 'Unable to scan directory' }
    return { status: tree.children.length ? 'success' : 'empty', tree }
  })

  ipcMain.handle(
    IpcChannels.exportHtml,
    async (_e, payload: ExportPayload): Promise<string | null> => {
      if (typeof payload?.html !== 'string') {
        throw new Error('exportHtml requires an html payload')
      }
      const chinese = (await dialogLanguage()) === 'zh-CN'
      const result = await dialog.showSaveDialog({
        title: chinese ? '导出 HTML' : 'Export HTML',
        defaultPath: payload.defaultPath,
        filters: [
          { name: 'HTML', extensions: ['html', 'htm'] },
          { name: chinese ? '所有文件' : 'All Files', extensions: ['*'] }
        ]
      })
      if (result.canceled || !result.filePath) {
        return null
      }
      await fs.writeFile(result.filePath, payload.html, 'utf-8')
      return result.filePath
    }
  )

  ipcMain.handle(
    IpcChannels.exportPdf,
    async (_e, payload: ExportPayload): Promise<string | null> => {
      if (typeof payload?.html !== 'string') {
        throw new Error('exportPdf requires an html payload')
      }
      const chinese = (await dialogLanguage()) === 'zh-CN'
      const result = await dialog.showSaveDialog({
        title: chinese ? '导出 PDF' : 'Export PDF',
        defaultPath: payload.defaultPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (result.canceled || !result.filePath) {
        return null
      }

      const tmpHtml = join(app.getPath('temp'), `markdownapp-export-${Date.now()}.html`)
      await fs.writeFile(tmpHtml, payload.html, 'utf-8')

      const exportWindow = new BrowserWindow({
        show: false,
        width: 900,
        height: 1200,
        webPreferences: {
          sandbox: true,
          webSecurity: true
        }
      })

      try {
        await exportWindow.loadFile(tmpHtml)
        const pdf = await exportWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
        })
        await fs.writeFile(result.filePath, pdf)
        return result.filePath
      } finally {
        exportWindow.destroy()
        await fs.unlink(tmpHtml).catch(() => {})
      }
    }
  )
}

export { getConfig }

async function scanDirectory(dirPath: string, depth = 0, markdownOnly = true, requestId?: string): Promise<FileNode | null> {
  let entries
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return null
  }

  const children: FileNode[] = []
  for (const entry of entries) {
    if (requestId && cancelledScans.has(requestId)) return null
    if (entry.name.startsWith('.')) {
      continue
    }
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name) || depth >= MAX_SCAN_DEPTH) {
        continue
      }
      const node = await scanDirectory(fullPath, depth + 1, markdownOnly, requestId)
      if (node && node.children.length > 0) {
        children.push(node)
      }
    } else if (entry.isFile() && (!markdownOnly || MARKDOWN_EXTENSIONS.has(extname(entry.name).toLowerCase()))) {
      children.push({ name: entry.name, path: fullPath, isDirectory: false, children: [] })
    }
  }

  children.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  return { name: basename(dirPath), path: dirPath, isDirectory: true, children }
}

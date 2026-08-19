import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { promises as fs, existsSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { IpcChannels } from '../shared/ipc'
import type { AppConfig, FileNode, ExportPayload, ImportImageResult } from '../shared/types'
import { allowMediaDirectory, allowMediaFile } from './protocol'

const SKIPPED_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '.idea', '.vscode', 'dist', 'out'])
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])
const MAX_SCAN_DEPTH = 8
const allowedFileRoots = new Set<string>()
const allowedFiles = new Set<string>()

const DEFAULT_CONFIG: AppConfig = {
  themeMode: 'system',
  assetsDir: 'assets',
  imagePathStrategy: 'relative'
}

let configCache: AppConfig | null = null

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

function configFilePath(): string {
  return join(app.getPath('userData'), 'config.json')
}

async function getConfig(): Promise<AppConfig> {
  if (configCache) {
    return configCache
  }
  try {
    const raw = await fs.readFile(configFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    const candidate = { ...DEFAULT_CONFIG, ...parsed }
    configCache = validateConfig(candidate)
  } catch {
    configCache = { ...DEFAULT_CONFIG }
  }
  return configCache
}

function validateConfig(config: AppConfig): AppConfig {
  if (
    typeof config.assetsDir !== 'string' ||
    !config.assetsDir.trim() ||
    isAbsolute(config.assetsDir) ||
    config.assetsDir.split(/[\\/]/).includes('..')
  ) {
    return { ...DEFAULT_CONFIG }
  }
  if (!['light', 'dark', 'system'].includes(config.themeMode)) {
    config.themeMode = DEFAULT_CONFIG.themeMode
  }
  if (!['relative', 'absolute'].includes(config.imagePathStrategy)) {
    config.imagePathStrategy = DEFAULT_CONFIG.imagePathStrategy
  }
  return config
}

async function setConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  if (patch.assetsDir !== undefined) {
    if (
      typeof patch.assetsDir !== 'string' ||
      !patch.assetsDir.trim() ||
      isAbsolute(patch.assetsDir) ||
      patch.assetsDir.split(/[\\/]/).includes('..')
    ) {
      throw new Error('assetsDir must be a non-empty relative directory')
    }
  }
  if (patch.themeMode !== undefined && !['light', 'dark', 'system'].includes(patch.themeMode)) {
    throw new Error('Invalid theme mode')
  }
  if (
    patch.imagePathStrategy !== undefined &&
    !['relative', 'absolute'].includes(patch.imagePathStrategy)
  ) {
    throw new Error('Invalid image path strategy')
  }
  const next = { ...(await getConfig()), ...patch }
  configCache = next
  await fs.writeFile(configFilePath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}

export function registerIpcHandlers(): void {
  ipcMain.on(IpcChannels.mediaAllow, (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !filePath.trim() || !existsSync(filePath)) {
      return
    }
    allowMediaFile(filePath)
  })

  ipcMain.handle(IpcChannels.appConfigGet, () => getConfig())
  ipcMain.handle(IpcChannels.appConfigSet, (_e, patch: Partial<AppConfig>) => setConfig(patch))

  ipcMain.handle(IpcChannels.dialogOpenFile, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
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
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif']
        },
        { name: 'All Files', extensions: ['*'] }
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
    return fs.readFile(filePath, 'utf-8')
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
    const tempPath = `${filePath}.markdownapp-${process.pid}-${Date.now()}.tmp`
    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, filePath)
    return filePath
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
        const target = uniqueFileName(assetsDir, fileName)
        await fs.mkdir(assetsDir, { recursive: true })
        allowMediaDirectory(assetsDir)
        await fs.copyFile(sourcePath, target)
        return { markdownPath: target, absolutePath: target }
      }

      const assetsDir = resolve(dirname(docPath), config.assetsDir)
      const target = uniqueFileName(assetsDir, fileName)
      await fs.mkdir(assetsDir, { recursive: true })
      allowMediaDirectory(dirname(docPath))
      await fs.copyFile(sourcePath, target)

      return {
        markdownPath: relative(dirname(docPath), target),
        absolutePath: target
      }
    }
  )

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
        const target = uniqueFileName(assetsDir, fileName)
        await fs.mkdir(assetsDir, { recursive: true })
        allowMediaDirectory(assetsDir)
        await fs.writeFile(target, Buffer.from(payload.data))
        return { markdownPath: target, absolutePath: target }
      }
      const assetsDir = resolve(dirname(docPath), config.assetsDir)
      const target = uniqueFileName(assetsDir, fileName)
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
    const result = await dialog.showSaveDialog({
      title: '保存 Markdown',
      defaultPath,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
      if (result.canceled || !result.filePath) {
        return null
      }
      allowFile(result.filePath)
      return result.filePath
  })

  ipcMain.handle(IpcChannels.dirScan, async (_e, dirPath: string): Promise<FileNode | null> => {
    if (typeof dirPath !== 'string') {
      return null
    }
    if (!isAllowedFile(dirPath)) {
      return null
    }
    return scanDirectory(dirPath)
  })

  ipcMain.handle(
    IpcChannels.exportHtml,
    async (_e, payload: ExportPayload): Promise<string | null> => {
      if (typeof payload?.html !== 'string') {
        throw new Error('exportHtml requires an html payload')
      }
      const result = await dialog.showSaveDialog({
        title: '导出 HTML',
        defaultPath: payload.defaultPath,
        filters: [
          { name: 'HTML', extensions: ['html', 'htm'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (result.canceled || !result.filePath) {
        return null
      }
      await fs.writeFile(result.filePath, payload.html, 'utf-8')
      return result.filePath
    }
  )

  ipcMain.handle(IpcChannels.exportPdf, async (_e, payload: ExportPayload): Promise<string | null> => {
    if (typeof payload?.html !== 'string') {
      throw new Error('exportPdf requires an html payload')
    }
    const result = await dialog.showSaveDialog({
      title: '导出 PDF',
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
  })
}

async function scanDirectory(dirPath: string, depth = 0): Promise<FileNode | null> {
  let entries
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return null
  }

  const children: FileNode[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name) || depth >= MAX_SCAN_DEPTH) {
        continue
      }
      const node = await scanDirectory(fullPath, depth + 1)
      if (node && node.children.length > 0) {
        children.push(node)
      }
    } else if (entry.isFile() && MARKDOWN_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
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

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[\\/:*?"<>|]/g, '-')
  if (!cleaned || /^\s*$/.test(cleaned)) {
    return 'pasted-image.png'
  }
  const ext = extname(cleaned).toLowerCase()
  if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'].includes(ext)) {
    return `${cleaned}.png`
  }
  return cleaned
}

function isSupportedImageName(fileName: string): boolean {
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'].includes(
    extname(fileName).toLowerCase()
  )
}

function uniqueFileName(dir: string, fileName: string): string {
  const ext = extname(fileName)
  const stem = basename(fileName, ext)
  let candidate = fileName
  let index = 1
  while (existsSync(join(dir, candidate))) {
    candidate = `${stem}-${index}${ext}`
    index += 1
  }
  return candidate
}

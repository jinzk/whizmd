import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { promises as fs, existsSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { IpcChannels } from '../shared/ipc'
import type { AppConfig, FileNode, ExportPayload, ImportImageResult, DirectoryScanResult } from '../shared/types'
import { addRecentFile, addRecentFolder, clearRecent, getRecent, removeRecentFile, removeRecentFolder } from './recentFiles'
import { allowMediaDirectory, allowMediaFile } from './protocol'
import { rebuildApplicationMenu } from './menu'
import { setMainWindowDirty, setMainWindowLanguage } from './window'

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

const DEFAULT_CONFIG: AppConfig = {
  themeMode: 'system',
  language: 'system',
  assetsDir: 'assets',
  imagePathStrategy: 'relative',
  autoSave: false,
  autoSaveDelay: 1000,
  editorFontSize: 16,
  editorContentWidth: 800,
  spellCheck: false,
  showMarkdownOnly: true
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
  if (!['system', 'zh-CN', 'en-US'].includes(config.language)) {
    config.language = DEFAULT_CONFIG.language
  }
  if (!['relative', 'absolute'].includes(config.imagePathStrategy)) {
    config.imagePathStrategy = DEFAULT_CONFIG.imagePathStrategy
  }
  if (![500, 1000, 3000].includes(config.autoSaveDelay)) config.autoSaveDelay = DEFAULT_CONFIG.autoSaveDelay
  if (![14, 16, 18].includes(config.editorFontSize)) config.editorFontSize = DEFAULT_CONFIG.editorFontSize
  if (![680, 800, 960].includes(config.editorContentWidth)) config.editorContentWidth = DEFAULT_CONFIG.editorContentWidth
  if (typeof config.autoSave !== 'boolean') config.autoSave = DEFAULT_CONFIG.autoSave
  if (typeof config.spellCheck !== 'boolean') config.spellCheck = DEFAULT_CONFIG.spellCheck
  if (typeof config.showMarkdownOnly !== 'boolean') config.showMarkdownOnly = DEFAULT_CONFIG.showMarkdownOnly
  return config
}

async function dialogLanguage(): Promise<'zh-CN' | 'en-US'> {
  const config = await getConfig()
  if (config.language !== 'system') return config.language
  return /^zh(?:-|$)/i.test(app.getLocale()) ? 'zh-CN' : 'en-US'
}

async function helpDocumentPath(): Promise<string | null> {
  const chinese = (await dialogLanguage()) === 'zh-CN'
  const filePath = join(app.getAppPath(), chinese ? 'HELP_CN.md' : 'HELP.md')
  if (!existsSync(filePath)) return null
  allowFile(filePath)
  allowDirectory(dirname(filePath))
  return filePath
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
  if (patch.language !== undefined && !['system', 'zh-CN', 'en-US'].includes(patch.language)) {
    throw new Error('Invalid language')
  }
  if (
    patch.imagePathStrategy !== undefined &&
    !['relative', 'absolute'].includes(patch.imagePathStrategy)
  ) {
    throw new Error('Invalid image path strategy')
  }
  if (patch.autoSave !== undefined && typeof patch.autoSave !== 'boolean') throw new Error('Invalid auto-save setting')
  if (patch.spellCheck !== undefined && typeof patch.spellCheck !== 'boolean') throw new Error('Invalid spell-check setting')
  if (patch.showMarkdownOnly !== undefined && typeof patch.showMarkdownOnly !== 'boolean') throw new Error('Invalid file filter setting')
  if (patch.autoSaveDelay !== undefined && ![500, 1000, 3000].includes(patch.autoSaveDelay)) throw new Error('Invalid auto-save delay')
  if (patch.editorFontSize !== undefined && ![14, 16, 18].includes(patch.editorFontSize)) throw new Error('Invalid editor font size')
  if (patch.editorContentWidth !== undefined && ![680, 800, 960].includes(patch.editorContentWidth)) throw new Error('Invalid editor content width')
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
    return fs.readFile(filePath, 'utf-8')
  })
  ipcMain.handle(IpcChannels.fileOpenRecent, async (_e, filePath: string) => {
    if (typeof filePath !== 'string' || !filePath.trim() || !existsSync(filePath)) throw new Error('Recent file does not exist')
    allowFile(filePath)
    allowDirectory(dirname(filePath))
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

import { app, BrowserWindow, dialog, nativeImage, shell } from 'electron'
import { join } from 'node:path'
import type { LanguageMode } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let mainWindowDirty = false
let mainWindowLanguage: LanguageMode = 'system'
let closeConfirmed = false
let closePromptOpen = false

export function createMainWindow(): BrowserWindow {
  const iconPath = join(app.getAppPath(), process.platform === 'darwin' ? 'build/icon.svg' : 'build/icon.png')
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'WhizMD',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (closeConfirmed || !mainWindowDirty || closePromptOpen) return
    event.preventDefault()
    const window = mainWindow
    if (!window) return
    closePromptOpen = true
    void dialog.showMessageBox(window, {
      type: 'warning',
      title: 'WhizMD',
      message: mainWindowLanguage === 'zh-CN' ? '有未保存的修改。' : 'There are unsaved changes.',
      detail: mainWindowLanguage === 'zh-CN' ? '确定要放弃修改并关闭窗口吗？' : 'Do you want to close the window without saving?',
      buttons: mainWindowLanguage === 'zh-CN' ? ['取消', '放弃修改并关闭'] : ['Cancel', 'Close without saving'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    }).then(({ response }) => {
      closePromptOpen = false
      if (response !== 1 || mainWindow !== window) return
      closeConfirmed = true
      window.close()
    }).catch(() => { closePromptOpen = false })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    mainWindowDirty = false
    mainWindowLanguage = 'system'
    closeConfirmed = false
    closePromptOpen = false
  })

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function setMainWindowDirty(window: BrowserWindow | null, dirty: boolean): void {
  if (window === mainWindow) mainWindowDirty = dirty
}

export function setMainWindowLanguage(window: BrowserWindow | null, language: LanguageMode): void {
  if (window === mainWindow) mainWindowLanguage = language === 'system'
    ? (/^zh(?:-|$)/i.test(app.getLocale()) ? 'zh-CN' : 'en-US')
    : language
}

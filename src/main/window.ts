import { BrowserWindow, dialog, shell } from 'electron'
import { join } from 'node:path'

let mainWindow: BrowserWindow | null = null

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'Markdown App',
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

  // Chromium reports a prevented beforeunload here. Use a native dialog so the
  // window close button remains reliable instead of leaving the window open.
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    if (!mainWindow) return
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['关闭窗口', '取消'],
      defaultId: 1,
      cancelId: 1,
      title: '关闭窗口',
      message: '当前文档有未保存的修改，确定要关闭窗口吗？'
    })
    if (choice === 0) {
      event.preventDefault()
    }
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
  })

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

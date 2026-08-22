import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { join } from 'node:path'
import { IpcChannels } from '../shared/ipc'

let mainWindow: BrowserWindow | null = null
let closeConfirmed = false
let closeRequestPending = false
let closeRequestReady = false

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
    if (closeConfirmed) {
      return
    }
    event.preventDefault()
    closeRequestPending = true
    if (closeRequestReady) {
      closeRequestPending = false
      mainWindow?.webContents.send(IpcChannels.windowCloseRequest)
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
    closeConfirmed = false
    closeRequestPending = false
    closeRequestReady = false
  })

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function confirmMainWindowClose(): void {
  if (!mainWindow) return
  closeConfirmed = true
  mainWindow.close()
}

export function markCloseRequestReady(): void {
  closeRequestReady = true
  if (closeRequestPending && mainWindow) {
    closeRequestPending = false
    mainWindow.webContents.send(IpcChannels.windowCloseRequest)
  }
}

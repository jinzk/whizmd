import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { getConfig, registerIpcHandlers } from './ipc'
import { registerMediaScheme, registerMediaProtocol } from './protocol'
import { rebuildApplicationMenu } from './menu'

const isMac = process.platform === 'darwin'

// The privileged scheme registration must happen before app.whenReady.
registerMediaScheme()
registerIpcHandlers()

app.whenReady().then(() => {
  // protocol.handle() requires the app to be ready.
  registerMediaProtocol()
  createMainWindow()
  void getInitialMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

async function getInitialMenu(): Promise<void> {
  const config = await getConfig()
  rebuildApplicationMenu(
    config.language === 'zh-CN' ||
      (config.language === 'system' && app.getLocale().toLowerCase().startsWith('zh'))
  )
}

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})

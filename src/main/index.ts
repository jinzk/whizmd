import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc'
import { registerMediaScheme, registerMediaProtocol } from './protocol'

const isMac = process.platform === 'darwin'

// The privileged scheme registration must happen before app.whenReady.
registerMediaScheme()
registerIpcHandlers()

app.whenReady().then(() => {
  // protocol.handle() requires the app to be ready.
  registerMediaProtocol()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})

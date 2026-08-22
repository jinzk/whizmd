import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IpcChannels } from '../shared/ipc'
import type { MarkdownAppApi, MenuCommand } from '../shared/types'

const api: MarkdownAppApi = {
  config: {
    get: () => ipcRenderer.invoke(IpcChannels.appConfigGet),
    set: (patch) => ipcRenderer.invoke(IpcChannels.appConfigSet, patch)
  },
  help: {
    open: () => ipcRenderer.invoke(IpcChannels.helpOpen)
  },
  window: {
    setTitle: (title) => ipcRenderer.invoke(IpcChannels.windowSetTitle, title),
    onMenuCommand: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, command: MenuCommand): void =>
        listener(command)
      ipcRenderer.on(IpcChannels.menuCommand, handler)
      return () => ipcRenderer.removeListener(IpcChannels.menuCommand, handler)
    },
    onCloseRequest: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(IpcChannels.windowCloseRequest, handler)
      return () => ipcRenderer.removeListener(IpcChannels.windowCloseRequest, handler)
    },
    readyForCloseRequests: () => ipcRenderer.invoke(IpcChannels.windowCloseReady),
    confirmClose: () => ipcRenderer.invoke(IpcChannels.windowCloseConfirm)
  },
  file: {
    openDialog: () => ipcRenderer.invoke(IpcChannels.dialogOpenFile),
    pickImage: () => ipcRenderer.invoke(IpcChannels.dialogOpenImage),
    openDirectoryDialog: () => ipcRenderer.invoke(IpcChannels.dialogOpenDirectory),
    saveFileDialog: (defaultPath) => ipcRenderer.invoke(IpcChannels.dialogSaveFile, defaultPath),
    read: (filePath) => ipcRenderer.invoke(IpcChannels.fileRead, filePath),
    write: (filePath, content) => ipcRenderer.invoke(IpcChannels.fileWrite, filePath, content),
    importImage: (sourcePath, docPath) =>
      ipcRenderer.invoke(IpcChannels.fileImportImage, sourcePath, docPath),
    saveImageBlob: (payload, docPath) =>
      ipcRenderer.invoke(IpcChannels.fileSaveImageBlob, payload, docPath)
  },
  dir: {
    scan: (dirPath) => ipcRenderer.invoke(IpcChannels.dirScan, dirPath)
  },
  exportHtml: (payload) => ipcRenderer.invoke(IpcChannels.exportHtml, payload),
  exportPdf: (payload) => ipcRenderer.invoke(IpcChannels.exportPdf, payload),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  mediaUrl: (absolutePath) => {
    ipcRenderer.send(IpcChannels.mediaAllow, absolutePath)
    const normalized = absolutePath.split('\\').join('/')
    const encoded = encodeURIComponent(normalized).replace(/%2F/gi, '/').replace(/%3A/gi, ':')
    return `media://${encoded.startsWith('/') ? '' : '/'}${encoded}`
  }
}

contextBridge.exposeInMainWorld('markdownApp', api)

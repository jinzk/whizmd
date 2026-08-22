import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IpcChannels } from '../shared/ipc'
import type { MarkdownAppApi, MenuCommand, RecentMenuTarget } from '../shared/types'

const api: MarkdownAppApi = {
  config: {
    get: () => ipcRenderer.invoke(IpcChannels.appConfigGet),
    set: (patch) => ipcRenderer.invoke(IpcChannels.appConfigSet, patch)
  },
  recent: {
    list: () => ipcRenderer.invoke(IpcChannels.recentList),
    addFile: (filePath) => ipcRenderer.invoke(IpcChannels.recentAdd, filePath),
    addFolder: (folderPath) => ipcRenderer.invoke(IpcChannels.recentAddFolder, folderPath),
    removeFile: (filePath) => ipcRenderer.invoke(IpcChannels.recentRemove, filePath),
    removeFolder: (folderPath) => ipcRenderer.invoke(IpcChannels.recentRemoveFolder, folderPath)
    ,clear: () => ipcRenderer.invoke(IpcChannels.recentClear)
  },
  help: {
    open: () => ipcRenderer.invoke(IpcChannels.helpOpen)
  },
  window: {
    setTitle: (title) => ipcRenderer.invoke(IpcChannels.windowSetTitle, title),
    setDirty: (dirty) => ipcRenderer.invoke(IpcChannels.windowSetDirty, dirty),
    setLanguage: (language) => ipcRenderer.invoke(IpcChannels.windowSetLanguage, language),
    onMenuCommand: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, command: MenuCommand): void =>
        listener(command)
      ipcRenderer.on(IpcChannels.menuCommand, handler)
      return () => ipcRenderer.removeListener(IpcChannels.menuCommand, handler)
    },
    onRecentMenuTarget: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, target: RecentMenuTarget): void => listener(target)
      ipcRenderer.on(IpcChannels.menuOpenRecent, handler)
      return () => ipcRenderer.removeListener(IpcChannels.menuOpenRecent, handler)
    },
  },
  file: {
    openDialog: () => ipcRenderer.invoke(IpcChannels.dialogOpenFile),
    pickImage: () => ipcRenderer.invoke(IpcChannels.dialogOpenImage),
    openDirectoryDialog: () => ipcRenderer.invoke(IpcChannels.dialogOpenDirectory),
    saveFileDialog: (defaultPath) => ipcRenderer.invoke(IpcChannels.dialogSaveFile, defaultPath),
    read: (filePath) => ipcRenderer.invoke(IpcChannels.fileRead, filePath),
    openRecent: (filePath) => ipcRenderer.invoke(IpcChannels.fileOpenRecent, filePath),
    openRecentFolder: (folderPath) => ipcRenderer.invoke(IpcChannels.fileOpenRecentFolder, folderPath),
    write: (filePath, content) => ipcRenderer.invoke(IpcChannels.fileWrite, filePath, content),
    importImage: (sourcePath, docPath) =>
      ipcRenderer.invoke(IpcChannels.fileImportImage, sourcePath, docPath),
    saveImageBlob: (payload, docPath) =>
      ipcRenderer.invoke(IpcChannels.fileSaveImageBlob, payload, docPath)
  },
  dir: {
    scan: (dirPath, markdownOnly, requestId) => ipcRenderer.invoke(IpcChannels.dirScan, dirPath, markdownOnly, requestId),
    cancelScan: (requestId) => ipcRenderer.send(IpcChannels.dirScanCancel, requestId)
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

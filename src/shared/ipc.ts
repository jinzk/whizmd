export const IpcChannels = {
  appConfigGet: 'config:get',
  appConfigSet: 'config:set',

  dialogOpenFile: 'dialog:open-file',
  dialogOpenImage: 'dialog:open-image',
  dialogOpenDirectory: 'dialog:open-directory',
  dialogSaveFile: 'dialog:save-file',
  fileRead: 'file:read',
  fileWrite: 'file:write',
  fileImportImage: 'file:import-image',
  fileSaveImageBlob: 'file:save-image-blob',
  dirScan: 'dir:scan',

  exportHtml: 'export:html',
  exportPdf: 'export:pdf',
  mediaAllow: 'media:allow'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

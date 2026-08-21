import { Menu } from 'electron'
import type { MenuCommand } from '../shared/types'
import { IpcChannels } from '../shared/ipc'
import { getMainWindow } from './window'

export function rebuildApplicationMenu(chinese: boolean): void {
  const label = chinese
    ? {
        file: '文件',
        edit: '编辑',
        newFile: '新建',
        openFolder: '打开文件夹',
        openFile: '打开文件',
        save: '保存',
        exportHtml: '导出 HTML',
        exportPdf: '导出 PDF',
        quit: '退出',
        undo: '撤销',
        redo: '重做',
        cut: '剪切',
        copy: '复制',
        paste: '粘贴',
        selectAll: '全选'
      }
    : {
        file: 'File',
        edit: 'Edit',
        newFile: 'New',
        openFolder: 'Open Folder',
        openFile: 'Open File',
        save: 'Save',
        exportHtml: 'Export HTML',
        exportPdf: 'Export PDF',
        quit: 'Quit',
        undo: 'Undo',
        redo: 'Redo',
        cut: 'Cut',
        copy: 'Copy',
        paste: 'Paste',
        selectAll: 'Select All'
      }
  const send = (command: MenuCommand): void => {
    getMainWindow()?.webContents.send(IpcChannels.menuCommand, command)
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: label.file,
        submenu: [
          { label: label.newFile, accelerator: 'CmdOrCtrl+N', click: () => send('new-file') },
          { label: label.openFolder, click: () => send('open-folder') },
          { label: label.openFile, accelerator: 'CmdOrCtrl+O', click: () => send('open-file') },
          { type: 'separator' },
          { label: label.save, accelerator: 'CmdOrCtrl+S', click: () => send('save') },
          { type: 'separator' },
          { label: label.exportHtml, click: () => send('export-html') },
          { label: label.exportPdf, click: () => send('export-pdf') },
          { type: 'separator' },
          { label: label.quit, role: 'quit' }
        ]
      },
      {
        label: label.edit,
        submenu: [
          { label: label.undo, role: 'undo', accelerator: 'CmdOrCtrl+Z' },
          { label: label.redo, role: 'redo', accelerator: 'CmdOrCtrl+Shift+Z' },
          { type: 'separator' },
          { label: label.cut, role: 'cut', accelerator: 'CmdOrCtrl+X' },
          { label: label.copy, role: 'copy', accelerator: 'CmdOrCtrl+C' },
          { label: label.paste, role: 'paste', accelerator: 'CmdOrCtrl+V' },
          { label: label.selectAll, role: 'selectAll', accelerator: 'CmdOrCtrl+A' }
        ]
      }
    ])
  )
}

import { app, dialog, Menu } from 'electron'
import { basename } from 'node:path'
import type { MenuCommand } from '../shared/types'
import { IpcChannels } from '../shared/ipc'
import { getMainWindow } from './window'
import { getRecent } from './recentFiles'

export async function rebuildApplicationMenu(chinese: boolean): Promise<void> {
  const label = chinese
    ? {
        file: '文件',
        edit: '编辑',
        newFile: '新建',
        openFolder: '打开文件夹',
        openFile: '打开文件',
        closeFile: '关闭',
        save: '保存',
        exportHtml: '导出 HTML',
        exportPdf: '导出 PDF',
        quit: '退出',
        undo: '撤销',
        redo: '重做',
        cut: '剪切',
        copy: '复制',
        paste: '粘贴',
        selectAll: '全选',
        help: '帮助',
        guide: '功能介绍',
         about: '关于'
         ,recentFiles: '最近文件', recentFolders: '最近文件夹', noRecent: '没有最近项目', clearRecent: '清空最近记录'
      }
    : {
        file: 'File',
        edit: 'Edit',
        newFile: 'New',
        openFolder: 'Open Folder',
        openFile: 'Open File',
        closeFile: 'Close',
        save: 'Save',
        exportHtml: 'Export HTML',
        exportPdf: 'Export PDF',
        quit: 'Quit',
        undo: 'Undo',
        redo: 'Redo',
        cut: 'Cut',
        copy: 'Copy',
        paste: 'Paste',
        selectAll: 'Select All',
        help: 'Help',
        guide: 'User Guide',
         about: 'About'
         ,recentFiles: 'Recent Files', recentFolders: 'Recent Folders', noRecent: 'No Recent Items', clearRecent: 'Clear Recent'
      }
  const send = (command: MenuCommand): void => {
    getMainWindow()?.webContents.send(IpcChannels.menuCommand, command)
  }

  const recent = await getRecent()
  const recentSubmenu = [
    { label: label.recentFiles, submenu: recent.files.length ? recent.files.map((path) => ({ label: basename(path), toolTip: path, click: () => getMainWindow()?.webContents.send(IpcChannels.menuOpenRecent, { kind: 'file', path }) })) : [{ label: label.noRecent, enabled: false }] },
    { label: label.recentFolders, submenu: recent.folders.length ? recent.folders.map((path) => ({ label: basename(path), toolTip: path, click: () => getMainWindow()?.webContents.send(IpcChannels.menuOpenRecent, { kind: 'folder', path }) })) : [{ label: label.noRecent, enabled: false }] },
    { type: 'separator' as const },
    { label: label.clearRecent, click: () => sendRecentClear() }
  ]
  const sendRecentClear = (): void => { getMainWindow()?.webContents.send(IpcChannels.menuOpenRecent, { kind: 'clear', path: '' }) }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: label.file,
        submenu: [
          { label: label.newFile, accelerator: 'CmdOrCtrl+N', click: () => send('new-file') },
          { label: label.openFolder, click: () => send('open-folder') },
          { label: label.openFile, accelerator: 'CmdOrCtrl+O', click: () => send('open-file') },
          { label: label.recentFiles, submenu: recentSubmenu },
          { label: label.closeFile, accelerator: 'CmdOrCtrl+W', click: () => send('close-file') },
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
      },
      {
        label: label.help,
        submenu: [
          { label: label.guide, click: () => send('open-help') },
          {
            label: label.about,
            click: () => {
              void dialog.showMessageBox({
                type: 'info',
                title: label.about,
                message: 'WhizMD',
                detail: chinese
                  ? `桌面 Markdown 编辑器\n版本 ${app.getVersion()}`
                  : `Desktop Markdown editor\nVersion ${app.getVersion()}`
              })
            }
          }
        ]
      }
    ])
  )
}

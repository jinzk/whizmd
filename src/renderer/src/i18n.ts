import { useEditorStore } from './store/editor'
import type { LanguageMode } from '@shared/types'

export type Locale = 'zh-CN' | 'en-US'

const messages = {
  'zh-CN': {
    newFile: '新建',
    openFolder: '打开文件夹',
    openFile: '打开文件',
    closeFile: '关闭',
    save: '保存',
    edit: '编辑',
    source: '源码',
    exportHtml: '导出 HTML',
    exportPdf: '导出 PDF',
    editMode: '编辑模式',
    switchTheme: '切换主题',
    theme: '主题',
    systemTheme: '系统主题',
    lightTheme: '浅色主题',
    darkTheme: '深色主题',
    closeWindow: '关闭窗口',
    continueClose: '继续关闭',
    saveAndClose: '保存并关闭',
    discardChanges: '放弃修改',
    closeDocumentMessage: '当前文档有未保存的修改，是否保存后关闭？',
    closeUnsavedMessage: '有未保存的文档，是否继续',
    closeMessage: '确定要关闭窗口吗？',
    cancel: '取消',
    untitledDocument: '未命名文档',
    language: '语言',
    system: '跟随系统',
    chinese: '中文',
    english: 'English',
    discard: '当前文档有未保存的修改，确定要放弃吗？',
    saveFailed: '保存失败：{{error}}',
    openFailed: '打开失败：{{error}}',
    noFolder: '未打开文件夹',
    openedFiles: '已打开文件',
    noOpenFiles: '没有已打开的文件',
    folder: '文件夹',
    chooseCodeLanguage: '选择代码语言',
    mermaid: 'Mermaid 图表',
    plaintext: '纯文本',
    untitled: '未命名'
  },
  'en-US': {
    newFile: 'New',
    openFolder: 'Open Folder',
    openFile: 'Open File',
    closeFile: 'Close',
    save: 'Save',
    edit: 'WYSIWYG',
    source: 'Source',
    exportHtml: 'Export HTML',
    exportPdf: 'Export PDF',
    editMode: 'Editing mode',
    switchTheme: 'Switch theme',
    theme: 'Theme',
    systemTheme: 'System theme',
    lightTheme: 'Light theme',
    darkTheme: 'Dark theme',
    closeWindow: 'Close window',
    continueClose: 'Continue closing',
    saveAndClose: 'Save and close',
    discardChanges: 'Discard changes',
    closeDocumentMessage: 'The current document has unsaved changes. Save before closing?',
    closeUnsavedMessage: 'There are unsaved documents. Continue?',
    closeMessage: 'Are you sure you want to close the window?',
    cancel: 'Cancel',
    untitledDocument: 'Untitled document',
    language: 'Language',
    system: 'System',
    chinese: '中文',
    english: 'English',
    discard: 'The current document has unsaved changes. Discard them?',
    saveFailed: 'Save failed: {{error}}',
    openFailed: 'Open failed: {{error}}',
    noFolder: 'No folder opened',
    openedFiles: 'Opened files',
    noOpenFiles: 'No open files',
    folder: 'Folder',
    chooseCodeLanguage: 'Choose code language',
    mermaid: 'Mermaid diagram',
    plaintext: 'Plain text',
    untitled: 'Untitled'
  }
} as const

export type TranslationKey = keyof (typeof messages)['zh-CN']

export function systemLocale(): Locale {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function resolveLocale(mode: LanguageMode | undefined): Locale {
  return mode && mode !== 'system' ? mode : systemLocale()
}

export function useI18n(): {
  locale: Locale
  t: (key: TranslationKey, values?: Record<string, string>) => string
} {
  const language = useEditorStore((state) => state.config?.language)
  const locale = resolveLocale(language)
  const t = (key: TranslationKey, values?: Record<string, string>): string => {
    let value: string = messages[locale][key]
    for (const [name, replacement] of Object.entries(values ?? {})) {
      value = value.replace(`{{${name}}}`, replacement)
    }
    return value
  }
  return { locale, t }
}

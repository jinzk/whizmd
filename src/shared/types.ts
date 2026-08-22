export type ThemeMode = 'light' | 'dark' | 'system'
export type LanguageMode = 'system' | 'zh-CN' | 'en-US'
export type MenuCommand =
  | 'new-file'
  | 'open-folder'
  | 'open-file'
  | 'close-file'
  | 'save'
  | 'export-html'
  | 'export-pdf'
  | 'open-help'

export interface AppConfig {
  themeMode: ThemeMode
  language: LanguageMode
  assetsDir: string
  /** 'relative' | 'absolute' */
  imagePathStrategy: 'relative' | 'absolute'
}

export interface EditorDocument {
  /** Absolute file path, or null for an unsaved buffer. */
  filePath: string | null
  content: string
}

export interface ImportImageResult {
  /** Path stored inside the markdown (relative to doc dir, absolute, or URL). */
  markdownPath: string
  /** Absolute path of the resulting file (assets copy or original). */
  absolutePath: string
}

export interface ExportHtmlResult {
  html: string
}

export interface ExportPayload {
  html: string
  /** Suggested file path for the save dialog. */
  defaultPath: string
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children: FileNode[]
}

export interface MarkdownAppApi {
  config: {
    get: () => Promise<AppConfig>
    set: (patch: Partial<AppConfig>) => Promise<AppConfig>
  }
  help: {
    open: () => Promise<string | null>
  }
  window: {
    setTitle: (title: string) => Promise<void>
    onMenuCommand: (listener: (command: MenuCommand) => void) => () => void
    onCloseRequest: (listener: () => void) => () => void
    readyForCloseRequests: () => Promise<void>
    confirmClose: () => Promise<void>
  }
  file: {
    openDialog: () => Promise<string | null>
    pickImage: () => Promise<string | null>
    openDirectoryDialog: () => Promise<string | null>
    saveFileDialog: (defaultPath?: string) => Promise<string | null>
    read: (filePath: string) => Promise<string>
    write: (filePath: string, content: string) => Promise<string>
    importImage: (sourcePath: string, docPath: string | null) => Promise<ImportImageResult>
    saveImageBlob: (
      payload: { data: Uint8Array; name: string },
      docPath: string | null
    ) => Promise<ImportImageResult>
  }
  dir: {
    scan: (dirPath: string) => Promise<FileNode | null>
  }
  exportHtml: (payload: ExportPayload) => Promise<string | null>
  exportPdf: (payload: ExportPayload) => Promise<string | null>
  getPathForFile: (file: File) => string
  mediaUrl: (absolutePath: string) => string
}

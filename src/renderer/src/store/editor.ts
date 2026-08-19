import { create } from 'zustand'
import type { Editor } from '@tiptap/core'
import type { AppConfig } from '@shared/types'

export type Mode = 'wysiwyg' | 'source'

interface EditorState {
  mode: Mode
  docPath: string | null
  content: string
  dirty: boolean
  config: AppConfig | null
  editor: Editor | null
  setMode: (mode: Mode) => void
  setDocPath: (path: string | null) => void
  setContent: (content: string) => void
  setDirty: (dirty: boolean) => void
  setConfig: (config: AppConfig) => void
  setEditor: (editor: Editor | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: 'wysiwyg',
  docPath: null,
  content: '',
  dirty: false,
  config: null,
  editor: null,
  setMode: (mode) => set({ mode }),
  setDocPath: (docPath) => set({ docPath }),
  setContent: (content) => set({ content }),
  setDirty: (dirty) => set({ dirty }),
  setConfig: (config) => set({ config }),
  setEditor: (editor) => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __editor: Editor | null }).__editor = editor
    }
    set({ editor })
  }
}))

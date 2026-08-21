import { create } from 'zustand'
import type { AppConfig } from '@shared/types'

export type Mode = 'wysiwyg' | 'source'

interface EditorState {
  mode: Mode
  config: AppConfig | null
  setMode: (mode: Mode) => void
  setConfig: (config: AppConfig) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: 'wysiwyg',
  config: null,
  setMode: (mode) => set({ mode }),
  setConfig: (config) => set({ config })
}))

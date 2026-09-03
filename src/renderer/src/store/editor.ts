import { create } from 'zustand'
import type { AppConfig } from '@shared/types'
import type { Editor } from '@tiptap/core'
import type { EditorView } from '@codemirror/view'

export type Mode = 'wysiwyg' | 'source'

export interface HeadingMenuTarget {
  /** Block position of the heading node (its start). */
  pos: number
  top: number
  left: number
  level: number
}

interface EditorState {
  mode: Mode
  config: AppConfig | null
  wysiwygEditor: Editor | null
  sourceEditorView: EditorView | null
  headingMenu: HeadingMenuTarget | null
  setMode: (mode: Mode) => void
  setConfig: (config: AppConfig) => void
  setWysiwygEditor: (editor: Editor | null) => void
  setSourceEditorView: (view: EditorView | null) => void
  setHeadingMenu: (menu: HeadingMenuTarget | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: 'wysiwyg',
  config: null,
  wysiwygEditor: null,
  sourceEditorView: null,
  headingMenu: null,
  setMode: (mode) => set({ mode }),
  setConfig: (config) => set({ config }),
  setWysiwygEditor: (editor) => set({ wysiwygEditor: editor }),
  setSourceEditorView: (view) => set({ sourceEditorView: view }),
  setHeadingMenu: (menu) => set({ headingMenu: menu })
}))

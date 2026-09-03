import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '../../editor/extensions'
import { useDocumentOutline } from '../useDocumentOutline'

function makeEditor(content: string): Editor {
  const editor = new Editor({ extensions: buildEditorExtensions() })
  editor.commands.setContent(content, { contentType: 'markdown' })
  return editor
}

describe('useDocumentOutline', () => {
  it('extracts headings and positions from the tiptap doc', () => {
    const editor = makeEditor('# 标题一\n\n## 小节\n\n正文')
    const { result } = renderHook(() => useDocumentOutline(editor, ''))
    expect(result.current.map((e) => ({ level: e.level, text: e.text }))).toEqual([
      { level: 1, text: '标题一' },
      { level: 2, text: '小节' }
    ])
    expect(result.current.every((e) => e.pos !== null)).toBe(true)
    editor.destroy()
  })

  it('falls back to markdown regex when the editor is unavailable', () => {
    const { result } = renderHook(() =>
      useDocumentOutline(null, '前言\n## 标题\n\n### 子标题\n\n正文 ## 不是标题')
    )
    expect(result.current.map((e) => ({ level: e.level, text: e.text, line: e.line }))).toEqual([
      { level: 2, text: '标题', line: 2 },
      { level: 3, text: '子标题', line: 4 }
    ])
    expect(result.current.every((e) => e.pos === null)).toBe(true)
  })

  it('updates the outline when the editor content changes', () => {
    const editor = makeEditor('# 一')
    const { result } = renderHook(() => useDocumentOutline(editor, ''))
    expect(result.current).toHaveLength(1)
    act(() => {
      editor.commands.setContent('# 一\n\n# 二', { contentType: 'markdown' })
    })
    expect(result.current.map((e) => e.text)).toEqual(['一', '二'])
    editor.destroy()
  })
})

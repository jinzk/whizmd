import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import type { EditorView } from '@codemirror/view'
import { WysiwygEditor } from '../WysiwygEditor'
import { SourceEditor } from '../SourceEditor'
import { OutlinePanel } from '../OutlinePanel'
import { useEditorStore } from '../../store/editor'
import type { EffectiveTheme } from '../../hooks/useTheme'

const CONTENT = '正文在前面占位\n\n# 标题一\n\n## 小节\n\n正文文本'

function WysiwygHarness(): React.JSX.Element {
  const content = CONTENT
  return (
    <div className="main-layout">
      <aside className="sidebar">
        <div className="sidebar-outline-panel">
          <OutlinePanel editor={null} content={content} sourceView={{ current: null }} />
        </div>
      </aside>
      <main className="editor-area">
        <div className="wysiwyg-editor">
          <WysiwygEditor content={content} onUpdate={() => undefined} />
        </div>
      </main>
    </div>
  )
}

describe('outline jump under StrictMode (dev runtime)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    useEditorStore.getState().setWysiwygEditor(null)
    useEditorStore.getState().setSourceEditorView(null)
  })

  it('renders the outline and scrolls the real h1 when clicking (wysiwyg)', async () => {
    render(
      <StrictMode>
        <WysiwygHarness />
      </StrictMode>
    )
    await waitFor(() => expect(screen.getByRole('button', { name: '标题一' })).toBeInTheDocument(), { timeout: 3000 })

    const scrollSpy = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollSpy as unknown as typeof Element.prototype.scrollIntoView
    try {
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: '标题一' }))
      })
    } finally {
      Element.prototype.scrollIntoView = original
    }

    expect(scrollSpy).toHaveBeenCalledWith({ block: 'center' })
    const editor = useEditorStore.getState().wysiwygEditor as Editor
    expect(editor).toBeTruthy()
    let pos = -1
    editor.state.doc.descendants((node, p) => {
      if (node.type.name === 'heading' && node.textContent === '标题一') { pos = p; return false }
      return undefined
    })
    expect((editor.view.nodeDOM(pos) as Element).tagName).toBe('H1')
  })

  it('moves the source cursor to the heading line (source mode)', async () => {
    function SourceHarness(): React.JSX.Element {
      return (
        <div className="main-layout">
          <aside className="sidebar">
            <div className="sidebar-outline-panel">
              <OutlinePanel editor={null} content={CONTENT} sourceView={{ current: null }} />
            </div>
          </aside>
          <main className="editor-area">
            <div className="source-editor">
              <SourceEditor content={CONTENT} onUpdate={() => undefined} theme={'light' as EffectiveTheme} />
            </div>
          </main>
        </div>
      )
    }
    render(
      <StrictMode>
        <SourceHarness />
      </StrictMode>
    )
    await waitFor(() => expect(screen.getByRole('button', { name: '标题一' })).toBeInTheDocument(), { timeout: 3000 })

    const view = useEditorStore.getState().sourceEditorView as EditorView
    expect(view).toBeTruthy()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '标题一' }))
    })
    const lineNo = CONTENT.split('\n').findIndex((l) => l.startsWith('# ')) + 1
    expect(view.state.selection.main.head).toBe(view.state.doc.line(lineNo).from)
  })
})

import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import { buildEditorExtensions } from '../../editor/extensions'
import { OutlinePanel } from '../OutlinePanel'

function makeEditor(content: string): Editor {
  const editor = new Editor({ extensions: buildEditorExtensions() })
  editor.commands.setContent(content, { contentType: 'markdown' })
  return editor
}

function Mounted({ editor, sourceView }: { editor: Editor; sourceView: { current: null } }): React.JSX.Element {
  return (
    <>
      <EditorContent editor={editor} />
      <OutlinePanel editor={editor} content="" sourceView={sourceView} />
    </>
  )
}

describe('OutlinePanel', () => {
  it('jumps the wysiwyg cursor to the clicked heading', () => {
    const editor = makeEditor('# 标题一\n\n## 小节\n\n正文文本')
    const sourceView = { current: null }
    render(<Mounted editor={editor} sourceView={sourceView} />)

    const headingOne = screen.getByRole('button', { name: '标题一' })
    act(() => {
      fireEvent.click(headingOne)
    })

    const $from = editor.state.selection.$from
    expect($from.parent.type.name).toBe('heading')
    expect(editor.getMarkdown().includes('标题一')).toBe(true)
    editor.destroy()
  })

  it('scrolls the clicked heading element into view', () => {
    const editor = makeEditor('# 标题一\n\n## 小节\n\n正文文本')
    const sourceView = { current: null }
    render(<Mounted editor={editor} sourceView={sourceView} />)

    const scrollSpy = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollSpy as unknown as typeof Element.prototype.scrollIntoView
    try {
      const headingOne = screen.getByRole('button', { name: '标题一' })
      act(() => {
        fireEvent.click(headingOne)
      })
    } finally {
      Element.prototype.scrollIntoView = original
    }

    expect(scrollSpy).toHaveBeenCalled()
    let headingPos = -1
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && headingPos === -1) { headingPos = pos; return false }
    })
    expect((editor.view.nodeDOM(headingPos) as Element).tagName).toBe('H1')
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'center' })
    editor.destroy()
  })

  it('renders all headings in document order', () => {
    const editor = makeEditor('# 一\n\n## 二\n\n### 三')
    const sourceView = { current: null }
    render(<Mounted editor={editor} sourceView={sourceView} />)
    const buttons = screen
      .getAllByRole('button')
      .filter((b) => !b.classList.contains('editor-heading-marker'))
    expect(buttons.map((b) => b.textContent).filter(Boolean)).toEqual(['一', '二', '三'])
    editor.destroy()
  })
})

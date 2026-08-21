import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '../extensions'

function createEditor(): Editor {
  return new Editor({ extensions: buildEditorExtensions() })
}

function pasteMarkdown(editor: Editor, markdown: string, html = ''): void {
  const clipboardData = {
    getData: (type: string) => type === 'text/plain' ? markdown : html,
    types: ['text/plain', ...(html ? ['text/html'] : [])]
  }
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: clipboardData })
  editor.view.dom.dispatchEvent(event)
}

describe('browser Markdown paste flow', () => {
  it('parses multiple Markdown blocks from a ClipboardEvent', () => {
    const editor = createEditor()
    pasteMarkdown(editor, '# 标题\n\n正文 **加粗**\n\n$x^2$')

    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['heading', 'paragraph', 'paragraph'])
    expect(editor.getMarkdown()).toContain('# 标题')
    expect(editor.getMarkdown()).toContain('正文 **加粗**')
    expect(editor.getJSON().content?.[2].content?.[0].type).toBe('inlineMath')
    editor.destroy()
  })

  it('uses plain text Markdown when HTML clipboard data is also present', () => {
    const editor = createEditor()
    pasteMarkdown(editor, '**安全文本**', '<script>alert(1)</script>')

    expect(editor.getMarkdown()).toBe('**安全文本**')
    expect(editor.getMarkdown()).not.toContain('script')
    editor.destroy()
  })

  it('keeps pasted Markdown literal inside a code block', () => {
    const editor = createEditor()
    editor.commands.setContent('```\nstart\n```', { contentType: 'markdown' })
    editor.commands.setTextSelection(3)
    pasteMarkdown(editor, '**not Markdown**')

    expect(editor.getText()).toContain('**not Markdown**')
    editor.destroy()
  })

  it('undoes the complete paste as one history step', () => {
    const editor = createEditor()
    pasteMarkdown(editor, '# 标题\n\n第二段')
    expect(editor.getText()).toContain('第二段')
    editor.commands.undo()
    expect(editor.getText()).toBe('')
    editor.destroy()
  })

  it('leaves image-only clipboard data to the default image handler', () => {
    const editor = createEditor()
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => '', types: ['Files'] } })
    expect(editor.view.dom.dispatchEvent(event)).toBe(true)
    expect(editor.getText()).toBe('')
    editor.destroy()
  })
})

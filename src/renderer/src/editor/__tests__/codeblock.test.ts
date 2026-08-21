import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { CodeBlockExtension } from '../codeBlock'
import { lowlight } from '../lowlight'
import { typeInto } from './helpers'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'

function createEditor(md: string): Editor {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockExtension.configure({ lowlight, defaultLanguage: 'plaintext' }),
      Markdown.configure({ indentation: { style: 'space', size: 2 } })
    ]
  })
  editor.commands.setContent(md, { contentType: 'markdown' })
  return editor
}

function toMarkdown(md: string): string {
  const editor = createEditor(md)
  const result = editor.getMarkdown()
  editor.destroy()
  return result
}

describe('code block language round-trip', () => {
  it('preserves the language tag', () => {
    const source = '```js\nconst x = 1\n```'
    const result = toMarkdown(source)
    expect(result).toContain('```js')
    expect(result).toContain('const x = 1')
  })

  it('renders without a language tag when none is specified', () => {
    const source = '```\nno language\n```'
    const result = toMarkdown(source)
    expect(result).toContain('```')
  })

  it('creates a mermaid code block node from markdown', () => {
    const editor = createEditor('```mermaid\ngraph TD\n  A-->B\n```')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'codeBlock',
      attrs: { language: 'mermaid' }
    })
    editor.destroy()
  })

  it('turns a leading less-than sign into an HTML code block', () => {
    const editor = createEditor('')
    typeInto(editor, '<')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'codeBlock',
      attrs: { language: 'html', htmlPreview: true, htmlEditing: true }
    })
    expect(editor.state.selection.from).toBe(2)
    editor.destroy()
  })

  it('keeps accepting HTML source after a leading less-than sign', () => {
    const editor = createEditor('')
    typeInto(editor, '<div><b></b></div>')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'codeBlock',
      attrs: { language: 'html', htmlPreview: true, htmlEditing: true },
      content: [{ type: 'text', text: '<div><b></b></div>' }]
    })
    editor.destroy()
  })

  it('marks HTML input blocks for a visible preview NodeView', () => {
    const editor = createEditor('')
    typeInto(editor, '<div>preview</div>')

    const node = editor.getJSON().content?.[0]
    expect(node).toMatchObject({
      type: 'codeBlock',
      attrs: { language: 'html', htmlPreview: true, htmlEditing: true },
      content: [{ type: 'text', text: '<div>preview</div>' }]
    })
    expect(node?.attrs?.htmlPreview).toBe(true)
    editor.destroy()
  })

  it('keeps HTML code blocks in the syntax-highlighted code block view', () => {
    const editor = createEditor('```html\n<strong>hello</strong>\n```')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'codeBlock',
      attrs: { language: 'html' },
      content: [{ type: 'text', text: '<strong>hello</strong>' }]
    })
    editor.destroy()
  })

  it('preserves the current indentation for HTML blocks', () => {
    const editor = createEditor('```html\n  <div>\n```')
    let end = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'codeBlock') {
        end = position + 1 + node.content.size
      }
    })
    editor.commands.setTextSelection(end)
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    const handled = editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event))

    expect(handled).toBe(true)
    expect(editor.getMarkdown()).toContain('```html\n  <div>\n  \n```')
    editor.destroy()
  })

  it('preserves the current indentation for generic code blocks', () => {
    const editor = createEditor('```js\n  const value = 1\n```')
    let end = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'codeBlock') end = position + 1 + node.content.size
    })
    editor.commands.setTextSelection(end)
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    const handled = editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event))

    expect(handled).toBe(true)
    expect(editor.getMarkdown()).toContain('  const value = 1\n  \n```')
    editor.destroy()
  })

  it('preserves the current indentation for Mermaid blocks', () => {
    const editor = createEditor('```mermaid\n  A-->B\n```')
    let end = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'codeBlock') end = position + 1 + node.content.size
    })
    editor.commands.setTextSelection(end)
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    const handled = editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event))

    expect(handled).toBe(true)
    expect(editor.getMarkdown()).toContain('  A-->B\n  \n```')
    editor.destroy()
  })

  it('handles Tab inside code blocks instead of moving focus', () => {
    const editor = createEditor('```html\n  <div>\n```')
    let end = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'codeBlock') end = position + 1 + node.content.size
    })
    editor.commands.setTextSelection(end)
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    const handled = editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event))

    expect(handled).toBe(true)
    expect(editor.getMarkdown()).toContain('  <div>  \n```')
    editor.destroy()
  })

  it('handles Shift+Tab inside code blocks', () => {
    const editor = createEditor('```js\n    value\n```')
    let end = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'codeBlock') end = position + 1 + node.content.size
    })
    editor.commands.setTextSelection(end)
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true })
    const handled = editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event))

    expect(handled).toBe(true)
    expect(editor.getMarkdown()).toContain('  value\n```')
    editor.destroy()
  })

  it('does not create an HTML preview block from a less-than sign in a table cell', () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        CodeBlockExtension.configure({ lowlight, defaultLanguage: 'plaintext' }),
        Table,
        TableRow,
        TableHeader,
        TableCell,
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ]
    })
    editor.commands.setContent('| Content |\n| --- |\n| start |', { contentType: 'markdown' })
    let position = 0
    editor.state.doc.descendants((node, nodePosition) => {
      if (node.type.name === 'paragraph' && node.textContent === 'start') {
        position = nodePosition + 1 + node.textContent.length
      }
    })
    editor.commands.setTextSelection(position)
    typeInto(editor, '<')

    expect(editor.getJSON()).not.toMatchObject({
      content: [expect.objectContaining({ type: 'codeBlock' })]
    })
    editor.destroy()
  })
})

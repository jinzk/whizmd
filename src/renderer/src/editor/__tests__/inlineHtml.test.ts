import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { InlineHtml, sanitizeInlineHtml } from '../inlineHtml'
import { typeInto } from './helpers'
import { buildEditorExtensions } from '../extensions'

function createEditor(source: string): Editor {
  const editor = new Editor({
    extensions: [
      StarterKit,
      InlineHtml,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({ indentation: { style: 'space', size: 2 } })
    ]
  })
  editor.commands.setContent(source, { contentType: 'markdown' })
  return editor
}

describe('inline HTML', () => {
  it('keeps allowed tags and safe styles', () => {
    const clean = sanitizeInlineHtml(
      '<span style="color: red; font-weight: bold">safe</span><strong>bold</strong>'
    )
    expect(clean).toContain('<span style="color: red; font-weight: bold">safe</span>')
    expect(clean).toContain('<strong>bold</strong>')
  })

  it('removes unsafe tags, attributes, URLs, and styles', () => {
    const clean = sanitizeInlineHtml(
      '<script>alert(1)</script><span onclick="alert(1)" style="color:red; background-image:url(javascript:x)">safe</span><a href="javascript:alert(1)">link</a>'
    )
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('javascript:')
    expect(clean).toContain('safe')
  })

  it('round-trips inline HTML in a table cell', () => {
    const editor = createEditor('| Content |\n| --- |\n| <strong style="color: red">bold</strong> |')
    const table = editor.getJSON().content?.[0]
    const row = table && 'content' in table ? table.content?.[1] : undefined
    const cell = row && 'content' in row ? row.content?.[0] : undefined
    const paragraph = cell && 'content' in cell ? cell.content?.[0] : undefined
    const inlineNode = paragraph && 'content' in paragraph ? paragraph.content?.[0] : undefined

    expect(inlineNode).toMatchObject({
      type: 'inlineHtml',
      attrs: { html: '<strong style="color: red">bold</strong>' }
    })
    expect(editor.getMarkdown()).toContain('<strong style="color: red">bold</strong>')
    editor.destroy()
  })

  it('parses inline HTML after existing text', () => {
    const editor = createEditor('11 <b>1</b>')
    const paragraph = editor.getJSON().content?.[0]
    const inlineNode = paragraph && 'content' in paragraph ? paragraph.content?.[1] : undefined

    expect(inlineNode).toMatchObject({
      type: 'inlineHtml',
      attrs: { html: '<b>1</b>' }
    })
    editor.destroy()
  })

  it('turns typed inline HTML after existing text into an HTML node', () => {
    const editor = createEditor('')
    typeInto(editor, '11 <b>1</b>')

    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'paragraph',
      content: [
        { type: 'text', text: '11 ' },
        { type: 'inlineHtml', attrs: { html: '<b>1</b>' } }
      ]
    })
    editor.destroy()
  })

  it('converts inline HTML typed in the middle of a line without leaving source text', () => {
    const editor = createEditor('before  after')
    editor.commands.setTextSelection(8)
    typeInto(editor, '<strong>middle</strong>')

    expect(editor.getJSON().content?.[0]).toMatchObject({
      content: [
        { type: 'text', text: 'before ' },
        { type: 'inlineHtml', attrs: { html: '<strong>middle</strong>' } },
        { type: 'text', text: ' after' }
      ]
    })
    expect(editor.getMarkdown()).toBe('before <strong>middle</strong> after')
    editor.destroy()
  })

  it('works with the production editor extensions', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, '11 <b>1</b>')
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [{ text: '11 ' }, { type: 'inlineHtml', attrs: { html: '<b>1</b>' } }] }]
    })
    editor.destroy()
  })

  it('converts typed inline HTML inside a table cell', () => {
    const editor = createEditor('| Content |\n| --- |\n| start |')
    let cellTextPosition = 0
    editor.state.doc.descendants((node, position) => {
      if (cellTextPosition === 0 && node.type.name === 'paragraph' && node.textContent === 'start') {
        cellTextPosition = position + 1 + node.textContent.length
      }
    })
    editor.view.dispatch(editor.state.tr.insertText('<b>1</b>', cellTextPosition))

    const table = editor.getJSON().content?.[0]
    const row = table && 'content' in table ? table.content?.[1] : undefined
    const cell = row && 'content' in row ? row.content?.[0] : undefined
    const paragraph = cell && 'content' in cell ? cell.content?.[0] : undefined
    const content = paragraph && 'content' in paragraph ? paragraph.content : []
    expect(content).toEqual([
      { type: 'text', text: 'start' },
      { type: 'inlineHtml', attrs: { html: '<b>1</b>' } }
    ])
    editor.destroy()
  })

  it('loads inline HTML after text with the production editor extensions', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '11 <b>1</b>',
      contentType: 'markdown'
    })
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [{ text: '11 ' }, { type: 'inlineHtml' }] }]
    })
    editor.destroy()
  })

  it('stores HTML source as editable inline node content in a table cell', () => {
    const editor = createEditor('| Content |\n| --- |\n| <b>1</b> |')
    const table = editor.getJSON().content?.[0]
    const row = table && 'content' in table ? table.content?.[1] : undefined
    const cell = row && 'content' in row ? row.content?.[0] : undefined
    const paragraph = cell && 'content' in cell ? cell.content?.[0] : undefined
    const inlineNode = paragraph && 'content' in paragraph ? paragraph.content?.[0] : undefined
    expect(inlineNode).toMatchObject({
      type: 'inlineHtml',
      attrs: { html: '<b>1</b>' }
    })
    editor.destroy()
  })

  it('allows changing the source text inside an inline HTML node', () => {
    const editor = createEditor('before <b>1</b> after')
    let nodePosition = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'inlineHtml') nodePosition = position
    })
    editor.view.dispatch(editor.state.tr.setNodeMarkup(nodePosition, undefined, { html: '<strong>1</b>' }))
    const updatedParagraph = editor.getJSON().content?.[0]
    const updatedInlineNode = updatedParagraph && 'content' in updatedParagraph
      ? updatedParagraph.content?.find((node) => node.type === 'inlineHtml')
      : undefined
    expect(updatedInlineNode).toMatchObject({
      type: 'inlineHtml',
      attrs: { html: '<strong>1</b>' }
    })
    editor.destroy()
  })

  it('keeps inline HTML adjacent to editable text on both sides', () => {
    const editor = createEditor('before <b>1</b> after')
    const paragraph = editor.getJSON().content?.[0]
    const content = paragraph && 'content' in paragraph ? paragraph.content ?? [] : []
    expect(content.map((node) => node.type)).toEqual(['text', 'inlineHtml', 'text'])
    editor.destroy()
  })

  it('keeps cursor navigation available on both sides of an inline HTML node', () => {
    const editor = createEditor('before <b>1</b> after')
    let nodePosition = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'inlineHtml') nodePosition = position
    })

    editor.commands.setTextSelection(nodePosition)
    const right = new KeyboardEvent('keydown', { key: 'ArrowRight' })
    const handledRight = editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, right))
    expect(handledRight).toBe(true)
    expect(editor.state.selection.from).toBe(nodePosition + 1)

    const left = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
    const handledLeft = editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, left))
    expect(handledLeft).toBe(true)
    expect(editor.state.selection.from).toBe(nodePosition)
    editor.destroy()
  })

  it('exits an inline HTML NodeSelection with arrow keys', () => {
    const editor = createEditor('before <b>1</b> after')
    let nodePosition = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'inlineHtml') nodePosition = position
    })
    editor.commands.setNodeSelection(nodePosition)

    const right = new KeyboardEvent('keydown', { key: 'ArrowRight' })
    const handled = editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, right))

    expect(handled).toBe(true)
    expect(editor.state.selection.from).toBe(nodePosition + 1)
    editor.destroy()
  })
})

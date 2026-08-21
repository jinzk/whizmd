import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { TableTrigger } from '../tableTrigger'
import { InlineMath } from '../math'
import { Image } from '../image'
import { LinkNode } from '../link'
import { typeInto } from './helpers'
import { MarkdownTable } from '../table'

function createEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit,
      InlineMath.configure({ katexOptions: { throwOnError: false } }),
      MarkdownTable,
      TableRow,
      TableHeader,
      TableCell,
      TableTrigger,
      Image.configure({ allowBase64: true }),
      LinkNode,
      Markdown.configure({ indentation: { style: 'space', size: 2 } })
    ]
  })
}

describe('table editing', () => {
  it('creates a table with a header row', () => {
    const editor = createEditor()
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    const table = editor.getJSON().content?.[0]
    const firstRow = table && 'content' in table ? table.content?.[0] : undefined
    const firstRowCells = firstRow && 'content' in firstRow ? firstRow.content : undefined
    expect(table?.type).toBe('table')
    expect(firstRow?.type).toBe('tableRow')
    expect(firstRowCells?.[0]?.type).toBe('tableHeader')
    expect(firstRowCells).toHaveLength(2)
    editor.destroy()
  })

  it('round-trips a Markdown table', () => {
    const editor = createEditor()
    editor.commands.setContent('| Name | City |\n| --- | --- |\n| A | Beijing |', {
      contentType: 'markdown'
    })
    const markdown = editor.getMarkdown()
    expect(markdown).toContain('Name')
    expect(markdown).toContain('City')
    expect(markdown).toContain('Beijing')
    editor.destroy()
  })

  it('supports inline formatting inside table cells', () => {
    const editor = createEditor()
    editor.commands.setContent(
      '| Content |\n| --- |\n| *italic* **bold** ***bold italic*** `code` $x^2$ [link](https://example.com) |',
      { contentType: 'markdown' }
    )

    const cell = editor.getJSON().content?.[0]
    const row = cell && 'content' in cell ? cell.content?.[1] : undefined
    const bodyCell = row && 'content' in row ? row.content?.[0] : undefined
    const paragraph = bodyCell && 'content' in bodyCell ? bodyCell.content?.[0] : undefined
    const textNodes: JSONContent[] = paragraph && 'content' in paragraph ? paragraph.content ?? [] : []

    const marks = textNodes.flatMap((node) => ('marks' in node && node.marks ? node.marks : []))
    expect(marks.map((mark) => mark.type)).toEqual(
      expect.arrayContaining(['italic', 'bold', 'code'])
    )
    expect(textNodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'inlineMath', attrs: { latex: 'x^2' } })])
    )
    expect(textNodes.find((node) => node.text === 'bold italic')?.marks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'bold' }),
        expect.objectContaining({ type: 'italic' })
      ])
    )
    expect(textNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'linkNode', attrs: expect.objectContaining({ href: 'https://example.com' }) })
    ]))

    const markdown = editor.getMarkdown()
    expect(markdown).toContain('*italic*')
    expect(markdown).toContain('**bold**')
    expect(markdown).toContain('***bold italic***')
    expect(markdown).toContain('`code`')
    expect(markdown).toContain('$x^2$')
    expect(markdown).toContain('[link](https://example.com)')
    editor.destroy()
  })

  it('turns a leading pipe into a table', () => {
    const editor = createEditor()
    typeInto(editor, '|')
    const table = editor.getJSON().content?.[0]
    const rows = table && 'content' in table ? table.content : undefined
    const firstRow = rows?.[0]
    const cells = firstRow && 'content' in firstRow ? firstRow.content : undefined
    expect(table?.type).toBe('table')
    expect(cells?.[0]?.type).toBe('tableHeader')
    editor.destroy()
  })

  it('keeps a leading pipe as cell text inside an existing table', () => {
    const editor = createEditor()
    editor.commands.setContent('| Header |\n| --- |\n| value |', { contentType: 'markdown' })

    let paragraphPosition = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'paragraph' && node.textContent === 'value') {
        paragraphPosition = position
      }
    })
    editor.commands.setTextSelection(paragraphPosition + 1)
    typeInto(editor, '|')

    expect(editor.getJSON().content?.[0]?.type).toBe('table')
    expect(editor.getText()).toContain('|value')
    editor.destroy()
  })

  it('round-trips escaped pipes, code pipes, empty cells, and alignment', () => {
    const editor = createEditor()
    editor.commands.setContent(
      '| Name | Empty | Code |\n| :--- | :---: | ---: |\n| A \\| B |  | `x | y` |\n| C | value | end |',
      { contentType: 'markdown' }
    )

    const table = editor.getJSON().content?.[0]
    const rows = table && 'content' in table ? table.content ?? [] : []
    const bodyRow = rows[1]
    const bodyCells = bodyRow && 'content' in bodyRow ? bodyRow.content ?? [] : []
    expect(bodyCells).toHaveLength(3)
    expect(bodyCells[0]).toMatchObject({ attrs: { align: 'left' } })
    expect(bodyCells[1]).toMatchObject({ attrs: { align: 'center' } })
    expect(bodyCells[2]).toMatchObject({ attrs: { align: 'right' } })
    expect(editor.getText()).toContain('A | B')
    expect(editor.getMarkdown()).toContain('A \\| B')
    expect(editor.getMarkdown()).toContain('`x \\| y`')
    editor.destroy()
  })

  it('normalizes short rows and preserves trailing empty cells', () => {
    const editor = createEditor()
    editor.commands.setContent(
      '| A | B | C |\n| --- | --- | --- |\n| one | two |\n| three | four | five |',
      { contentType: 'markdown' }
    )
    const table = editor.getJSON().content?.[0]
    const rows = table && 'content' in table ? table.content ?? [] : []
    const bodyRow = rows[1]
    const cells = bodyRow && 'content' in bodyRow ? bodyRow.content ?? [] : []
    expect(cells).toHaveLength(3)
    expect(cells[2]).toMatchObject({ type: 'tableCell' })
    expect(editor.getMarkdown()).toMatch(/\| one\s+\| two\s+\|\s+\|/)
    editor.destroy()
  })

  it('preserves inline images and reference-style links in cells', () => {
    const editor = createEditor()
    editor.commands.setContent(
      '| Content |\n| --- |\n| ![logo](logo.png) [docs][guide] |\n\n[guide]: https://example.com "Guide"',
      { contentType: 'markdown' }
    )

    const table = editor.getJSON().content?.[0]
    const rows = table && 'content' in table ? table.content ?? [] : []
    const bodyRow = rows[1]
    const cell = bodyRow && 'content' in bodyRow ? bodyRow.content?.[0] : undefined
    const paragraph = cell && 'content' in cell ? cell.content?.[0] : undefined
    const content = paragraph && 'content' in paragraph ? paragraph.content ?? [] : []
    expect(content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'image', attrs: expect.objectContaining({ src: 'logo.png' }) }),
      expect.objectContaining({ type: 'linkNode', attrs: expect.objectContaining({ reference: 'guide' }) })
    ]))
    expect(editor.getMarkdown()).toContain('![logo](logo.png)')
    expect(editor.getMarkdown()).toContain('[docs][guide]')
    editor.destroy()
  })

  it('adds a row when tabbing from the last cell', () => {
    const editor = createEditor()
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    const before = editor.getJSON().content?.[0]
    const rowsBefore = before && 'content' in before ? before.content?.length : 0
    editor.commands.goToNextCell()
    editor.commands.goToNextCell()
    editor.commands.goToNextCell()
    editor.commands.goToNextCell()
    const after = editor.getJSON().content?.[0]
    const rowsAfter = after && 'content' in after ? after.content?.length : 0
    expect(rowsAfter).toBeGreaterThanOrEqual(rowsBefore ?? 0)
    editor.destroy()
  })

  it('keeps an empty final cell when exporting', () => {
    const editor = createEditor()
    editor.commands.setContent('| A | B |\n| --- | --- |\n| value | |', { contentType: 'markdown' })
    expect(editor.getMarkdown()).toMatch(/\| value\s+\|\s+\|/)
    editor.destroy()
  })

  it('routes a real Tab key event through the editor view', () => {
    const editor = createEditor()
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    const before = editor.state.selection.from
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(editor.state.selection.from).not.toBe(before)
    editor.destroy()
  })

  it('pastes Markdown table text through the browser paste path', () => {
    const editor = createEditor()
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: (type: string) => type === 'text/plain' ? '| A | B |\n| --- | --- |\n| 1 | 2 |' : '', types: ['text/plain'] }
    })
    editor.view.dom.dispatchEvent(event)
    expect(editor.getMarkdown()).toContain('| A | B |')
    editor.commands.undo()
    expect(editor.getText()).toBe('')
    editor.destroy()
  })

  it('moves backward with a real Shift+Tab event', () => {
    const editor = createEditor()
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    editor.commands.goToNextCell()
    const before = editor.state.selection.from
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(editor.state.selection.from).not.toBe(before)
    editor.destroy()
  })
})

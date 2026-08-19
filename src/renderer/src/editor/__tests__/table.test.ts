import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { TableTrigger } from '../tableTrigger'
import { InlineMath } from '../math'
import { typeInto } from './helpers'

function createEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit,
      InlineMath.configure({ katexOptions: { throwOnError: false } }),
      Table,
      TableRow,
      TableHeader,
      TableCell,
      TableTrigger,
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
      expect.arrayContaining(['italic', 'bold', 'code', 'link'])
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
    expect(marks.find((mark) => mark.type === 'link')?.attrs).toMatchObject({
      href: 'https://example.com'
    })

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
})

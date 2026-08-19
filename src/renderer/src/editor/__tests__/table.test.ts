import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { TableTrigger } from '../tableTrigger'
import { typeInto } from './helpers'

function createEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit,
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
})

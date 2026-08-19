import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { InlineMath, BlockMath } from '../math'
import { typeInto } from './helpers'

function toMarkdown(md: string): string {
  const editor = new Editor({
    extensions: [
      StarterKit,
      InlineMath.configure({ katexOptions: { throwOnError: false } }),
      BlockMath.configure({ katexOptions: { throwOnError: false } }),
      Markdown.configure({ indentation: { style: 'space', size: 2 } })
    ]
  })
  editor.commands.setContent(md, { contentType: 'markdown' })
  const result = editor.getMarkdown()
  editor.destroy()
  return result
}

function toJson(md: string) {
  const editor = new Editor({
    extensions: [
      StarterKit,
      InlineMath.configure({ katexOptions: { throwOnError: false } }),
      BlockMath.configure({ katexOptions: { throwOnError: false } }),
      Markdown.configure({ indentation: { style: 'space', size: 2 } })
    ]
  })
  editor.commands.setContent(md, { contentType: 'markdown' })
  const result = editor.getJSON()
  editor.destroy()
  return result
}

describe('math round-trip', () => {
  it('preserves inline math', () => {
    const source = 'Inline $E = mc^2$ math.'
    const result = toMarkdown(source)
    expect(result).toContain('$E = mc^2$')
  })

  it('preserves block math (fenced)', () => {
    const source = '$$\n\\sum_{i=1}^{n} x_i\n$$'
    const result = toMarkdown(source)
    expect(result).toContain('$$')
    expect(result).toContain('\\sum_{i=1}^{n} x_i')
  })

  it('creates a blockMath node for standard double-dollar blocks', () => {
    const json = toJson('$$\nE = mc^2\n$$')
    expect(json.content?.[0]).toMatchObject({
      type: 'blockMath',
      attrs: { latex: 'E = mc^2' }
    })
  })

  it('turns a typed double-dollar marker into an editable block math module', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        InlineMath.configure({ katexOptions: { throwOnError: false } }),
        BlockMath.configure({ katexOptions: { throwOnError: false } }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ]
    })
    typeInto(editor, '$$')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'blockMath',
      attrs: { latex: '' }
    })
    editor.destroy()
  })

  it('parses single-line block math', () => {
    const source = '$$\\int_0^1 x dx$$'
    const result = toMarkdown(source)
    expect(result).toContain('\\int_0^1 x dx')
  })

  it('keeps the legacy triple-dollar block syntax readable', () => {
    const result = toMarkdown('$$$\nE = mc^2\n$$$')
    expect(result).toContain('E = mc^2')
  })

  it('does not treat currency as math', () => {
    const source = 'The price is $100.'
    const result = toMarkdown(source)
    expect(result).toBe(source)
  })
})

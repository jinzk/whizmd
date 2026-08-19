import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { InlineMath, BlockMath } from '../math'
import { typeInto } from './helpers'
import { buildEditorExtensions } from '../extensions'

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
  it('converts single-dollar inline math with the production extensions', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, '面积 $x^2$ 结束')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      content: [
        { type: 'text', text: '面积 ' },
        { type: 'inlineMath', attrs: { latex: 'x^2' } },
        { type: 'text', text: ' 结束' }
      ]
    })
    editor.destroy()
  })

  it.each(['$x$', '文字$x$文字', '文字 $x$文字', '文字$x$ 文字'])(
    'parses inline math at boundary: %s',
    (source) => {
      const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })
      let mathCount = 0
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'inlineMath') mathCount += 1
      })
      expect(mathCount).toBe(1)
      expect(editor.getMarkdown()).toBe(source)
      editor.destroy()
    }
  )

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

  it('keeps text immediately after an inline formula', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        InlineMath.configure({ katexOptions: { throwOnError: false } }),
        BlockMath.configure({ katexOptions: { throwOnError: false } }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ]
    })
    typeInto(editor, '$x$a')
    expect(editor.getMarkdown()).toBe('$x$a')
    const paragraph = editor.getJSON().content?.[0]
    const content = paragraph && 'content' in paragraph ? paragraph.content ?? [] : []
    expect(content).toEqual([
      { type: 'inlineMath', attrs: { latex: 'x' } },
      { type: 'text', text: 'a' }
    ])
    editor.destroy()
  })

  it('round-trips an inline formula followed immediately by text from Markdown', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        InlineMath.configure({ katexOptions: { throwOnError: false } }),
        BlockMath.configure({ katexOptions: { throwOnError: false } }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ],
      content: '$x$a',
      contentType: 'markdown'
    })
    expect(editor.getMarkdown()).toBe('$x$a')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      content: [
        { type: 'inlineMath', attrs: { latex: 'x' } },
        { type: 'text', text: 'a' }
      ]
    })
    editor.destroy()
  })

  it('keeps the caret after an inline formula', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        InlineMath.configure({ katexOptions: { throwOnError: false } }),
        BlockMath.configure({ katexOptions: { throwOnError: false } }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ]
    })
    typeInto(editor, '$x$a')
    const first = editor.getJSON()
    expect(editor.state.selection.from).toBe(3)
    typeInto(editor, 'a')
    expect(editor.getMarkdown()).toBe('$x$aa')
    expect(first).toMatchObject({ content: [{ content: [{ type: 'inlineMath' }, { type: 'text', text: 'a' }] }] })
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [{ type: 'inlineMath' }, { type: 'text', text: 'aa' }] }]
    })
    editor.destroy()
  })

  it('does not expose markdown delimiters as editable document text', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        InlineMath.configure({ katexOptions: { throwOnError: false } }),
        BlockMath.configure({ katexOptions: { throwOnError: false } }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ],
      content: '$x$a',
      contentType: 'markdown'
    })
    let mathPosition = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'inlineMath') mathPosition = position
    })
    expect(editor.state.doc.nodeAt(mathPosition)?.attrs.latex).toBe('x')
    expect(editor.state.doc.nodeAt(mathPosition)?.content.size).toBe(0)
    expect(editor.getMarkdown()).toBe('$x$a')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      content: [
        { type: 'inlineMath', attrs: { latex: 'x' } },
        { type: 'text', text: 'a' }
      ]
    })
    editor.destroy()
  })

  it('preserves formula and adjacent text when selecting the formula', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        InlineMath.configure({ katexOptions: { throwOnError: false } }),
        BlockMath.configure({ katexOptions: { throwOnError: false } }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ]
    })
    typeInto(editor, '$x$a')
    let mathPosition = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'inlineMath') mathPosition = position
    })
    expect(editor.getMarkdown()).toBe('$x$a')
    editor.commands.setNodeSelection(mathPosition)
    expect(editor.getMarkdown()).toBe('$x$a')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      content: [
        { type: 'inlineMath', attrs: { latex: 'x' } },
        { type: 'text', text: 'a' }
      ]
    })
    editor.destroy()
  })

  it('allows the caret to move freely across inline math boundaries', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        InlineMath.configure({ katexOptions: { throwOnError: false } }),
        BlockMath.configure({ katexOptions: { throwOnError: false } }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ],
      content: 'ab $x$ cd',
      contentType: 'markdown'
    })
    let mathPosition = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'inlineMath') mathPosition = position
    })
    const nodeSize = editor.state.doc.nodeAt(mathPosition)?.nodeSize ?? 0

    const positions = [
      mathPosition, // before the node
      mathPosition + 1, // inside source, before first $
      mathPosition + nodeSize // after the node
    ]
    for (const position of positions) {
      editor.commands.setTextSelection(position)
      expect(editor.state.selection.from).toBe(position)
    }
    expect(editor.getMarkdown()).toBe('ab $x$ cd')
    editor.destroy()
  })

  it('deletes a selected inline formula without deleting adjacent text', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        InlineMath.configure({ katexOptions: { throwOnError: false } }),
        BlockMath.configure({ katexOptions: { throwOnError: false } }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ],
      content: 'before $x$ after',
      contentType: 'markdown'
    })
    let mathPosition = 0
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'inlineMath') mathPosition = position
    })
    editor.commands.setNodeSelection(mathPosition)
    editor.commands.deleteSelection()
    expect(editor.getMarkdown()).toBe('before  after')
    editor.destroy()
  })

  it('deletes the formula with Backspace or Delete at its boundary', () => {
    for (const key of ['Backspace', 'Delete']) {
      const editor = new Editor({
        extensions: [
          StarterKit,
          InlineMath.configure({ katexOptions: { throwOnError: false } }),
          BlockMath.configure({ katexOptions: { throwOnError: false } }),
          Markdown.configure({ indentation: { style: 'space', size: 2 } })
        ],
        content: 'a$x$b',
        contentType: 'markdown'
      })
      let mathPosition = 0
      editor.state.doc.descendants((node, position) => {
        if (node.type.name === 'inlineMath') mathPosition = position
      })
      const cursor = key === 'Backspace' ? mathPosition + 1 : mathPosition
      editor.commands.setTextSelection(cursor)
      const event = new KeyboardEvent('keydown', { key, bubbles: true })
      const handled = editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event))
      expect(handled).toBe(true)
      expect(editor.getMarkdown()).toBe('ab')
      editor.destroy()
    }
  })
})

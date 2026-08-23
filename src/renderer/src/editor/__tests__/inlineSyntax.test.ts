import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '../extensions'
import { typeInto } from './helpers'

function createEditor(content = ''): Editor {
  return new Editor({
    extensions: buildEditorExtensions(),
    content,
    contentType: content ? 'markdown' : undefined
  })
}

describe('inline syntax nodes', () => {
  it.each([
    ['*italic*', 'italic'],
    ['**bold**', 'bold'],
    ['***bold italic***', 'boldItalic'],
    ['~~strike~~', 'strike']
  ])('parses %s as a %s node', (source, kind) => {
    const editor = createEditor(source)
    expect(editor.getJSON().content?.[0]).toMatchObject({
      content: [{ type: 'inlineSyntax', attrs: { kind, value: expect.any(String) } }]
    })
    expect(editor.getMarkdown()).toContain(source)
    editor.destroy()
  })

  it('turns typed syntax into an editable node', () => {
    const editor = createEditor()
    typeInto(editor, 'before **bold** after')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      content: [
        { type: 'text', text: 'before ' },
        { type: 'inlineSyntax', attrs: { kind: 'bold', value: 'bold' } },
        { type: 'text', text: ' after' }
      ]
    })
    editor.destroy()
  })

  it.each([
    ['before **odd** after', 'bold'],
    ['before ***odd*** after', 'boldItalic'],
    ['before *odd* after', 'italic'],
    ['before ~~odd~~ after', 'strike']
  ])('converts a pair typed in the middle of a line: %s', (source, kind) => {
    const editor = createEditor()
    typeInto(editor, source)

    expect(editor.getJSON().content?.[0]).toMatchObject({
      content: [
        { type: 'text', text: 'before ' },
        { type: 'inlineSyntax', attrs: { kind, value: 'odd' } },
        { type: 'text', text: ' after' }
      ]
    })
    expect(editor.getMarkdown()).toBe(source)
    editor.destroy()
  })

  it('does not leave markers visible when converting a pair after a prefix', () => {
    const editor = createEditor('prefix **value** suffix')
    const content = editor.getJSON().content?.[0]

    expect(content).toMatchObject({
      content: [
        { type: 'text', text: 'prefix ' },
        { type: 'inlineSyntax', attrs: { kind: 'bold', value: 'value' } },
        { type: 'text', text: ' suffix' }
      ]
    })
    expect(content && 'content' in content ? content.content?.some((node) => node.type === 'text' && 'text' in node && /\*\*/.test(node.text ?? '')) : false).toBe(false)
    editor.destroy()
  })

  it('converts a pair when the cursor leaves it from the right side', () => {
    const editor = createEditor()
    typeInto(editor, 'before **value** after')
    editor.commands.setTextSelection(1)

    expect(editor.getJSON().content?.[0]).toMatchObject({
      content: [
        { type: 'text', text: 'before ' },
        { type: 'inlineSyntax', attrs: { kind: 'bold', value: 'value' } },
        { type: 'text', text: ' after' }
      ]
    })
    editor.destroy()
  })

  it('keeps markdown markers out of the node content', () => {
    const editor = createEditor('a ***mix*** b')
    let syntax: ReturnType<Editor['getJSON']>['content'][number] | undefined
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'inlineSyntax') syntax = node.toJSON()
    })
    expect(syntax).toMatchObject({ type: 'inlineSyntax', attrs: { kind: 'boldItalic', value: 'mix' } })
    expect(editor.getMarkdown()).toBe('a ***mix*** b')
    editor.destroy()
  })

  it('keeps nested Markdown markers in the paired content', () => {
    const editor = createEditor('==**重点**==')
    expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({ type: 'inlineDecoration', attrs: { value: '**重点**' } })
    editor.destroy()
  })

})

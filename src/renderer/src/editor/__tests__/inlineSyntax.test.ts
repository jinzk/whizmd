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
})

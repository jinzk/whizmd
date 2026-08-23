import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '../extensions'
import { typeInto } from './helpers'

describe('paired trigger regressions', () => {
  it('converts adjacent math, italic, and highlight syntax', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })

    typeInto(editor, '$a$*2*==1==')

    expect(editor.getMarkdown()).toBe('$a$*2*==1==')
    editor.destroy()
  })

  it('converts highlight syntax after an inline atom', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, '$a$==d==')
    expect(editor.getMarkdown()).toBe('$a$==d==')
    editor.destroy()
  })

  it('converts adjacent highlight pairs', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, '==a====d==')
    expect(editor.getMarkdown()).toBe('==a====d==')
    editor.destroy()
  })

  it('converts decoration nodes after existing inline nodes', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, '$a$==d== a^1^  b~2~')
    const content = editor.getJSON().content?.[0]?.content ?? []
    expect(content.map((node) => node.type)).toEqual([
      'inlineMath',
      'inlineDecoration',
      'text',
      'inlineDecoration',
      'text',
      'inlineDecoration'
    ])
    editor.destroy()
  })

})

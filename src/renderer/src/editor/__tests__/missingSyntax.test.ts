import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '../extensions'

function createEditor(source: string): Editor {
  return new Editor({
    extensions: buildEditorExtensions(),
    content: source,
    contentType: 'markdown'
  })
}

describe('common Markdown syntax', () => {
  it('parses and renders task lists', () => {
    const editor = createEditor('- [ ] todo\n- [x] done\n  - [ ] nested')
    expect(editor.getJSON()).toMatchObject({
      content: [{
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: false } },
          { type: 'taskItem', attrs: { checked: true } }
        ]
      }]
    })
    expect(editor.getMarkdown()).toContain('- [ ] todo')
    expect(editor.getMarkdown()).toContain('- [x] done')
    editor.destroy()
  })

  it('supports horizontal rules and hard breaks', () => {
    const editor = createEditor('before  \nafter\n\n---')
    expect(editor.getJSON()).toMatchObject({
      content: [
        { content: [{ type: 'text', text: 'before' }, { type: 'hardBreak' }, { type: 'text', text: 'after' }] },
        { type: 'horizontalRule' }
      ]
    })
    expect(editor.getMarkdown()).toContain('before  \nafter')
    expect(editor.getMarkdown()).toContain('---')
    editor.destroy()
  })

  it('keeps escaped Markdown markers as text', () => {
    const editor = createEditor('\\*not italic\\* \\$not math\\$')
    expect(editor.getJSON()).toMatchObject({
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '*not italic* $not math$' }] }]
    })
    editor.destroy()
  })

  it('parses bare URLs as links', () => {
    const editor = createEditor('Visit https://example.com now')
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [
        { type: 'text', text: 'Visit ' },
        { type: 'text', text: 'https://example.com', marks: [{ type: 'link' }] },
        { type: 'text', text: ' now' }
      ] }]
    })
    editor.destroy()
  })
})

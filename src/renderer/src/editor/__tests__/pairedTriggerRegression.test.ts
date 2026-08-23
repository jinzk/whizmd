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

  it('keeps links in the unified inline sequence', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    editor.commands.setContent('$a$ [doc](https://example.com) ==x==', { contentType: 'markdown' })
    const content = editor.getJSON().content?.[0]?.content ?? []
    expect(content.map((node) => node.type)).toEqual([
      'inlineMath',
      'text',
      'linkNode',
      'text',
      'inlineDecoration'
    ])
    expect(editor.getMarkdown()).toBe('$a$ [doc](https://example.com) ==x==')
    editor.destroy()
  })

  it('preserves image links as a dedicated inline node', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    editor.commands.setContent('[![图](image.png "标题")](https://example.com)', { contentType: 'markdown' })
    expect(editor.getJSON().content?.[0]?.content?.[0]).toMatchObject({
      type: 'imageLinkNode',
      attrs: { src: 'image.png', alt: '图', title: '标题', href: 'https://example.com' }
    })
    expect(editor.getMarkdown()).toBe('[![图](image.png "标题")](https://example.com)')
    editor.destroy()
  })

  it('keeps image links as imageLinkNode after an attribute update', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    editor.commands.setContent('[![图](image.png "标题")](https://old.test)', { contentType: 'markdown' })
    const imageLink = editor.state.doc.firstChild?.firstChild
    expect(imageLink?.type.name).toBe('imageLinkNode')
    editor.view.dispatch(editor.state.tr.setNodeMarkup(1, undefined, { ...imageLink?.attrs, href: 'https://new.test' }))
    expect(editor.state.doc.firstChild?.firstChild?.type.name).toBe('imageLinkNode')
    editor.destroy()
  })

  it('keeps text, image, and text in one paragraph for vertical rendering', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    editor.commands.setContent('上方文字 ![图片](image.png) 下方文字', { contentType: 'markdown' })
    const paragraph = editor.state.doc.firstChild
    expect(paragraph?.type.name).toBe('paragraph')
    expect(paragraph?.content.content.map((node) => node.type.name)).toEqual(['text', 'image', 'text'])
    expect(editor.getMarkdown()).toBe('上方文字 ![图片](image.png) 下方文字')
    editor.destroy()
  })

  it('keeps text, image link, and text in one paragraph for vertical rendering', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    editor.commands.setContent('上方文字 [![图片](image.png)](https://example.com) 下方文字', { contentType: 'markdown' })
    const paragraph = editor.state.doc.firstChild
    expect(paragraph?.type.name).toBe('paragraph')
    expect(paragraph?.content.content.map((node) => node.type.name)).toEqual(['text', 'imageLinkNode', 'text'])
    expect(editor.getMarkdown()).toBe('上方文字 [![图片](image.png)](https://example.com) 下方文字')
    editor.destroy()
  })

  it('does not reinterpret an image link when typing an opening bracket after it', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    editor.commands.setContent('[![图片](image.png)](https://example.com)', { contentType: 'markdown' })
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    typeInto(editor, '[')
    expect(editor.state.doc.firstChild?.content.content.map((node) => node.type.name)).toContain('imageLinkNode')
    expect(editor.state.doc.firstChild?.content.content.some((node) => node.type.name === 'linkNode')).toBe(false)
    editor.destroy()
  })

  it('keeps adjacent links and images after an image link as separate nodes', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    editor.commands.setContent('[![a](a.png)](https://a.test)[b](https://b.test)![c](c.png)', { contentType: 'markdown' })
    expect(editor.state.doc.firstChild?.content.content.map((node) => node.type.name)).toEqual([
      'imageLinkNode', 'linkNode', 'image'
    ])
    editor.destroy()
  })

})

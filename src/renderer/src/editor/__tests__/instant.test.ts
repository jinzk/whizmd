import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { InlineMath, BlockMath } from '../math'
import { pasteInto, typeInto } from './helpers'
import { LinkNode } from '../link'

function createEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: {}, link: { markdownLinks: true } }),
      InlineMath.configure({ katexOptions: { throwOnError: false } }),
      BlockMath.configure({ katexOptions: { throwOnError: false } }),
      LinkNode,
      Markdown.configure({ indentation: { style: 'space', size: 2 } })
    ]
  })
}

/**
 * These tests mirror Typora's "instant syntax trigger": the moment the
 * closing marker is typed the text converts and the markers disappear.
 */
describe('instant syntax trigger', () => {
  it('converts # + space to a heading immediately', () => {
    const editor = createEditor()
    typeInto(editor, '# 标题')
    const json = editor.getJSON()
    expect(json.content?.[0].type).toBe('heading')
    expect(json.content?.[0].attrs?.level).toBe(1)
  })

  it('converts **bold** when the closing asterisks are typed', () => {
    const editor = createEditor()
    typeInto(editor, '你好 **加粗**')
    const json = editor.getJSON()
    const text = json.content?.[0].content?.[1]
    expect(text?.marks?.some((m) => m.type === 'bold')).toBe(true)
    expect(editor.getMarkdown()).toContain('**加粗**')
  })

  it('converts *italic* when the closing single asterisk is typed', () => {
    const editor = createEditor()
    typeInto(editor, '你好 *斜体*')
    const json = editor.getJSON()
    const text = json.content?.[0].content?.[1]
    expect(text?.marks?.some((m) => m.type === 'italic')).toBe(true)
  })

  it('converts ~~strike~~ when closing tildes are typed', () => {
    const editor = createEditor()
    typeInto(editor, '你好 ~~删除~~')
    const json = editor.getJSON()
    const text = json.content?.[0].content?.[1]
    expect(text?.marks?.some((m) => m.type === 'strike')).toBe(true)
  })

  it('converts `backticks` to inline code when the closing tick is typed', () => {
    const editor = createEditor()
    typeInto(editor, '你好 `code`')
    const json = editor.getJSON()
    const text = json.content?.[0].content?.[1]
    expect(text?.marks?.some((m) => m.type === 'code')).toBe(true)
  })

  it('converts - + space to a bullet list immediately', () => {
    const editor = createEditor()
    typeInto(editor, '- 项目')
    const json = editor.getJSON()
    expect(json.content?.[0].type).toBe('bulletList')
  })

  it('converts 1. + space to an ordered list immediately', () => {
    const editor = createEditor()
    typeInto(editor, '1. 项目')
    const json = editor.getJSON()
    expect(json.content?.[0].type).toBe('orderedList')
  })

  it('converts > + space to a blockquote immediately', () => {
    const editor = createEditor()
    typeInto(editor, '> 引用')
    const json = editor.getJSON()
    expect(json.content?.[0].type).toBe('blockquote')
  })

  it('converts triple backticks + space to a code block immediately', () => {
    const editor = createEditor()
    typeInto(editor, '``` ')
    const json = editor.getJSON()
    expect(json.content?.[0].type).toBe('codeBlock')
  })

  it('converts [text](url) to a link node immediately', () => {
    const editor = createEditor()
    editor.commands.setContent('请看 [文档](https://example.com)', { contentType: 'markdown' })
    const json = editor.getJSON()
    const link = json.content?.[0].content?.[1]
    expect(link).toMatchObject({
      type: 'linkNode',
      attrs: { text: '文档', href: 'https://example.com' }
    })
  })

  it('turns [text]( into an editable link node', () => {
    const editor = createEditor()
    typeInto(editor, '[文档](')
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'paragraph' })
    expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({
      type: 'linkNode',
      attrs: { text: '文档', href: '' }
    })
    editor.destroy()
  })

  it('converts $x^2$ to inline math when the closing dollar is typed', () => {
    const editor = createEditor()
    typeInto(editor, '面积 $x^2$')
    const json = editor.getJSON()
    expect(json.content?.[0].content?.[1]?.type).toBe('inlineMath')
  })

  it('does not let an unmatched paired marker convert', () => {
    const editor = createEditor()
    typeInto(editor, '$100.')
    expect(editor.getJSON().content?.[0].content).toEqual([{ type: 'text', text: '$100.' }])
  })

  it('keeps escaped paired markers as text', () => {
    const editor = createEditor()
    typeInto(editor, '\\==not highlighted\\==')
    expect(editor.getJSON().content?.[0].content).toEqual([{ type: 'text', text: '\\==not highlighted\\==' }])
  })

  it('keeps empty and repeated paired markers as text', () => {
    const editor = createEditor()
    typeInto(editor, '==== ^^ ~~')
    expect(editor.getText()).toContain('====')
    expect(editor.getText()).toContain('^^')
    expect(editor.getText()).toContain('~~')
  })

  it('gives formula priority over a caret inside its delimiters', () => {
    const editor = createEditor()
    typeInto(editor, '$a^2$')
    const content = editor.getJSON().content?.[0].content ?? []
    expect(content).toEqual([{ type: 'inlineMath', attrs: { latex: 'a^2' } }])
  })

  it('keeps direct text insertion separate from Markdown paste parsing', () => {
    const editor = createEditor()
    pasteInto(editor, '$x^2$')
    expect(editor.getJSON().content?.[0].content).toEqual([{ type: 'text', text: '$x^2$' }])
    editor.commands.setContent('$x^2$', { contentType: 'markdown' })
    expect(editor.getJSON().content?.[0].content?.[0]?.type).toBe('inlineMath')
  })

  it('does not trigger input rules while composing text', () => {
    const editor = createEditor()
    const { view } = editor
    view.dispatch(editor.state.tr.insertText('==中文=='))
    view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    expect(editor.getText()).toBe('==中文==')
  })
})

describe('smart cursor position mapping', () => {
  it('deletes the rendered bold word, not its markdown markers, on backspace', () => {
    const editor = createEditor()
    editor.commands.setContent('**加粗**', { contentType: 'markdown' })
        // The rendered doc contains only the two characters 加粗 (markers are
    // removed). Backspacing the last char 粗 (pos 2..3) leaves **加**.
    editor.commands.setTextSelection({ from: 2, to: 3 })
    editor.commands.deleteSelection()
    const md = editor.getMarkdown()
    expect(md).toBe('**加**')
  })

  it('turning bold off on the selected rendered text strips the markers', () => {
    const editor = createEditor()
    editor.commands.setContent('中间**加粗**后', { contentType: 'markdown' })
    // The bold text spans rendered positions 3..5 (加粗). Select exactly it,
    // then unset the mark the same way the FormatToolbar does.
    editor.commands.setTextSelection({ from: 3, to: 5 })
    editor.chain().toggleBold().run()
    const md = editor.getMarkdown()
    expect(md).toBe('中间加粗后')
  })

  it('supports undo after an inline paired trigger conversion', () => {
    const editor = createEditor()
    typeInto(editor, '$x$')
    expect(editor.getJSON().content?.[0].content?.[0]?.type).toBe('inlineMath')
    editor.commands.undo()
    expect(editor.getJSON().content?.[0].content?.some((node) => node.type === 'inlineMath') ?? false).toBe(false)
  })
})

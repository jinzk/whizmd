import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '../extensions'

describe('advanced Markdown syntax', () => {
  it('round-trips footnote references and definitions', () => {
    const source = '正文[^1]\n\n[^1]: 脚注内容'
    const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })
    expect(editor.getJSON()).toMatchObject({
      content: [
        { content: [{ type: 'text', text: '正文\n' }, { type: 'footnoteReference', attrs: { id: '1' } }] },
        { type: 'footnoteDefinition', attrs: { id: '1', content: '脚注内容' } }
      ]
    })
    expect(editor.getMarkdown()).toContain('[^1]')
    expect(editor.getMarkdown()).toContain('[^1]: 脚注内容')
    editor.destroy()
  })

  it('round-trips GitHub alert blocks', () => {
    const source = '> [!WARNING]\n> 注意内容'
    const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'markdownAlert',
      attrs: { kind: 'WARNING', content: '注意内容' }
    })
    expect(editor.getMarkdown()).toContain(source)
    editor.destroy()
  })

  it('parses inline decorations and definition lists', () => {
    const source = 'H~2~O ==重点== x^2^\n\nTerm\n: Definition'
    const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })
    const nodeTypes: string[] = []
    editor.state.doc.descendants((node) => {
      nodeTypes.push(node.type.name)
    })

    expect(nodeTypes).toEqual(expect.arrayContaining(['inlineDecoration', 'definitionListItem']))
    expect(editor.getMarkdown()).toContain('H~2~O')
    expect(editor.getMarkdown()).toContain('==重点==')
    expect(editor.getMarkdown()).toContain('x^2^')
    expect(editor.getMarkdown()).toContain('Term\n: Definition')
    editor.destroy()
  })

  it('preserves reference-style links and images', () => {
    const source = '[文档][docs] ![图][image]'
    const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [
        { type: 'linkNode', attrs: { text: '文档', reference: 'docs' } },
        { type: 'text', text: ' ' },
        { type: 'image', attrs: { alt: '图', reference: 'image' } }
      ] }]
    })
    expect(editor.getMarkdown()).toContain('[文档][docs]')
    expect(editor.getMarkdown()).toContain('![图][image]')
    editor.destroy()
  })
})

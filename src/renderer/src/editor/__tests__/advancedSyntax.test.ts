import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '../extensions'
import { typeInto } from './helpers'
import { buildReferenceRegistry } from '../referenceRegistry'
import { renameReferenceDefinition } from '../reference/referenceCommands'

describe('advanced Markdown syntax', () => {
  it('round-trips footnote references and definitions', () => {
    const source = '正文[^1]\n\n[^1]: 脚注内容'
    const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })
    expect(editor.getJSON()).toMatchObject({
      content: [
        { content: [{ type: 'text', text: '正文\n' }, { type: 'footnoteReference', attrs: { id: '1' } }] },
        { type: 'footnoteDefinition', attrs: { id: '1' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '脚注内容' }] }] }
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
      attrs: { kind: 'WARNING' },
      content: [{ content: [{ type: 'text', text: '注意内容' }] }]
    })
    expect(editor.getMarkdown()).toContain(source)
    editor.destroy()
  })

  it('keeps the alert NodeView class aligned with its preview styling contract', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '> [!WARNING]\n> 注意内容',
      contentType: 'markdown'
    })
    const extension = editor.extensionManager.extensions.find(({ name }) => name === 'markdownAlert')
    expect((extension?.config as { addNodeView?: unknown } | undefined)?.addNodeView).toBeTypeOf('function')
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'markdownAlert', attrs: { kind: 'WARNING' } })
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

  it.each([
    ['==重点==', 'highlight'],
    ['x^2^', 'superscript'],
    ['H~2~O', 'subscript']
  ])('converts %s immediately while typing', (source, kind) => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, source)
    expect(editor.getJSON().content?.[0]?.content).toEqual(
      expect.arrayContaining([expect.objectContaining({
        type: 'inlineDecoration',
        attrs: expect.objectContaining({ kind })
      })])
    )
    expect(editor.getMarkdown()).toContain(source)
    editor.destroy()
  })

  it('converts a footnote reference immediately while typing', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, '正文[^1]')
    expect(editor.getJSON().content?.[0]?.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'footnoteReference', attrs: { id: '1' } })])
    )
    expect(editor.getMarkdown()).toContain('正文[^1]')
    editor.destroy()
  })

  it('keeps the caret after an inline decoration node', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, '==重点==后')
    expect(editor.getJSON().content?.[0]?.content).toEqual([
      { type: 'inlineDecoration', attrs: { kind: 'highlight', value: '重点' } },
      { type: 'text', text: '后' }
    ])
    expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1)
    editor.destroy()
  })

  it('registers the inline decoration node view used for second editing', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '==重点==',
      contentType: 'markdown'
    })
    const decoration = editor.state.doc.firstChild?.firstChild
    expect(decoration?.type.name).toBe('inlineDecoration')
    const extension = editor.extensionManager.extensions.find(({ name }) => name === 'inlineDecoration')
    expect((extension?.config as { addNodeView?: unknown } | undefined)?.addNodeView).toBeTypeOf('function')
    editor.destroy()
  })

  it('renders decoration nodes with kind-specific preview classes', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '==重点== x^2^ H~2~O',
      contentType: 'markdown'
    })
    const kinds: string[] = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'inlineDecoration') kinds.push(String(node.attrs.kind))
    })
    expect(kinds).toEqual(['highlight', 'superscript', 'subscript'])
    expect(editor.getMarkdown()).toBe('==重点== x^2^ H~2~O')
    editor.destroy()
  })

  it('does not convert new inline syntax inside a code block', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    editor.commands.setCodeBlock()
    typeInto(editor, '==not highlight==')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'codeBlock',
      content: [{ type: 'text', text: '==not highlight==' }]
    })
    editor.destroy()
  })

  it('converts a complete alert tag into an editable block while typing', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, '> [!NOTE]')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'markdownAlert',
      attrs: { kind: 'NOTE' },
      content: [{ type: 'paragraph' }]
    })
    editor.destroy()
  })

  it('converts a term followed by colon-space into an editable definition', () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, 'Term')
    editor.commands.enter()
    typeInto(editor, ': ')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'definitionListItem',
      attrs: { term: 'Term' },
      content: [{ type: 'paragraph' }]
    })
    editor.destroy()
  })

  it('parses and triggers reference definitions after colon-space', () => {
    const loaded = new Editor({
      extensions: buildEditorExtensions(),
      content: '[docs]: https://example.com "Docs"',
      contentType: 'markdown'
    })
    expect(loaded.getJSON().content?.[0]).toMatchObject({
      type: 'referenceDefinition',
      attrs: { id: 'docs', destination: 'https://example.com', title: 'Docs' }
    })
    expect(loaded.getMarkdown()).toContain('[docs]: https://example.com "Docs"')
    loaded.destroy()

    const editor = new Editor({ extensions: buildEditorExtensions() })
    typeInto(editor, '[image]: ')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'referenceDefinition',
      attrs: { id: 'image', destination: '' }
    })
    editor.destroy()
  })

  it('preserves alert content when changing its type', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '> [!NOTE]\n> 内容',
      contentType: 'markdown'
    })
    const alert = editor.state.doc.firstChild
    expect(alert?.type.name).toBe('markdownAlert')
    editor.view.dispatch(editor.state.tr.setNodeMarkup(0, undefined, { kind: 'WARNING' }))
    expect(editor.getMarkdown()).toContain('> [!WARNING]')
    expect(editor.getMarkdown()).toContain('> 内容')
    editor.destroy()
  })

  it('updates a definition term without changing its body', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: 'Term\n: Definition',
      contentType: 'markdown'
    })
    editor.view.dispatch(editor.state.tr.setNodeMarkup(0, undefined, { term: 'New term' }))
    expect(editor.getMarkdown()).toContain('New term\n: Definition')
    editor.destroy()
  })

  it('registers shared reference definitions and usages', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '[文档][docs] ![图][docs]\n\n[docs]: https://example.com',
      contentType: 'markdown'
    })
    const registry = buildReferenceRegistry(editor)
    const entry = registry.get('docs')
    expect(entry?.destination).toBe('https://example.com')
    expect(entry?.definitionPosition).not.toBeNull()
    expect(entry?.usages).toHaveLength(2)
    editor.destroy()
  })

  it('records duplicate definitions and all link/image usages', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '[a][docs] ![b][docs] [c][docs]\n\n[docs]: /one\n[docs]: /two',
      contentType: 'markdown'
    })
    const entry = buildReferenceRegistry(editor).get('docs')
    expect(entry?.usages).toHaveLength(3)
    expect(entry?.duplicateDefinitionPositions).toHaveLength(1)
    expect(entry?.destination).toBe('/one')
    editor.destroy()
  })

  it('renames every link and image usage in one transaction', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '[a][old] ![b][old]\n\n[old]: /target',
      contentType: 'markdown'
    })
    const definitionPosition = buildReferenceRegistry(editor).get('old')?.definitionPosition
    expect(typeof definitionPosition).toBe('number')
    expect(renameReferenceDefinition(editor, definitionPosition as number, 'new')).toBe(true)
    expect(editor.getMarkdown()).toContain('[a][new]')
    expect(editor.getMarkdown()).toContain('![b][new]')
    expect(editor.getMarkdown()).toContain('[new]: /target')
    editor.commands.undo()
    expect(editor.getMarkdown()).toContain('[a][old]')
    editor.destroy()
  })

  it('preserves multi-paragraph footnotes with nested lists and code', () => {
    const source = '正文[^1]\n\n[^1]: 第一段 ==重点==\n\n    第二段\n\n    - 项目一\n    - 项目二\n\n        ```ts\n        const value = 1\n        ```'
    const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })
    let definition: ReturnType<typeof editor.getJSON>['content'][number] | undefined
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'footnoteDefinition') definition = node.toJSON()
    })
    expect(definition).toMatchObject({ type: 'footnoteDefinition', content: expect.arrayContaining([
      expect.objectContaining({ type: 'paragraph' }),
      expect.objectContaining({ type: 'bulletList' })
    ]) })
    expect(definition?.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'paragraph', content: expect.arrayContaining([
        expect.objectContaining({ type: 'inlineDecoration', attrs: expect.objectContaining({ kind: 'highlight' }) })
      ]) }),
      expect.objectContaining({ type: 'codeBlock', content: [{ type: 'text', text: 'const value = 1' }] })
    ]))
    expect(editor.getMarkdown()).toContain('第二段')
    expect(editor.getMarkdown()).toContain('- 项目一')
    expect(editor.getMarkdown()).toContain('    ```ts\n    const value = 1\n    ```')
    editor.destroy()
  })

  it('preserves multi-paragraph definitions with nested lists and inline syntax', () => {
    const source = 'Term\n: 第一段 [文档](https://example.com)\n\n  第二段\n\n  - 项目一\n  - 项目二'
    const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })
    let definition: ReturnType<typeof editor.getJSON>['content'][number] | undefined
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'definitionListItem') definition = node.toJSON()
    })
    expect(definition).toMatchObject({ type: 'definitionListItem', attrs: { term: 'Term' }, content: expect.arrayContaining([
      expect.objectContaining({ type: 'paragraph' }),
      expect.objectContaining({ type: 'bulletList' })
    ]) })
    expect(definition?.content?.[0]).toEqual(expect.objectContaining({
      type: 'paragraph',
      content: expect.arrayContaining([expect.objectContaining({ type: 'linkNode', attrs: expect.objectContaining({ href: 'https://example.com' }) })])
    }))
    expect(editor.getMarkdown()).toContain('- 项目一')
    expect(editor.getMarkdown()).toContain(': 第一段 [文档](https://example.com)')
    editor.destroy()
  })
})

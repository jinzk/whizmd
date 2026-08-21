import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '../extensions'
import { renderHtmlBlockPreview, sanitizeHtmlBlock } from '../htmlBlock'

describe('raw HTML blocks', () => {
  it('preserves an HTML table block without converting it to a Tiptap table', () => {
    const source = '前文。\n\n<table>\n  <tr><th colspan="2">标题</th></tr>\n  <tr><td rowspan="2">分类</td><td>项目一</td></tr>\n  <tr><td>项目二</td></tr>\n</table>\n\n后文。'
    const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })

    expect(editor.getJSON().content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'paragraph' }),
      expect.objectContaining({ type: 'htmlBlock', attrs: expect.objectContaining({ html: expect.stringContaining('colspan="2"') }) })
    ]))
    expect(editor.getJSON().content).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: 'table' })]))
    expect(editor.getMarkdown()).toContain('<td rowspan="2">分类</td>')
    expect(editor.getMarkdown()).toContain('后文。')
    editor.destroy()
  })

  it('keeps raw HTML blocks separate from surrounding Markdown blocks', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '第一段\n\n<div class="note">\n  <p>HTML 内容</p>\n</div>\n\n第二段',
      contentType: 'markdown'
    })
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['paragraph', 'htmlBlock', 'paragraph'])
    editor.destroy()
  })

  it('keeps Markdown-looking text inside an HTML block as raw HTML', () => {
    const source = '<div class="content">\n- this stays HTML text\n**not a Markdown paragraph**\n</div>'
    const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })
    const block = editor.getJSON().content?.[0]

    expect(block).toMatchObject({ type: 'htmlBlock' })
    expect(block).not.toMatchObject({ type: 'bulletList' })
    expect(block).not.toMatchObject({ type: 'paragraph', content: expect.anything() })
    expect(editor.getMarkdown()).toContain('- this stays HTML text')
    expect(editor.getMarkdown()).toContain('**not a Markdown paragraph**')
    editor.destroy()
  })

  it('renders Markdown inside GitHub-style HTML containers in the preview', () => {
    const source = `<div align="center">\n\n# GlbViewer\n\n**跨平台 GLB 预览器**\n\n![.NET](https://img.shields.io/badge/.NET-8.0-blue)\n\n</div>`
    const preview = renderHtmlBlockPreview(source)

    expect(preview).toContain('<h1>GlbViewer</h1>')
    expect(preview).toContain('<strong>跨平台 GLB 预览器</strong>')
    expect(preview).toContain('<img src="https://img.shields.io/badge/.NET-8.0-blue" alt=".NET">')
    expect(preview).toContain('align="center"')
  })

  it('keeps the HTML block as a selectable node for source editing', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '<div align="center">\n\n# GlbViewer\n\n</div>',
      contentType: 'markdown'
    })

    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'htmlBlock' })
    expect(editor.getJSON().content?.[0].attrs).toHaveProperty('html')
    editor.destroy()
  })

  it('recognizes uppercase HTML block tags and comments', () => {
    const editor = new Editor({
      extensions: buildEditorExtensions(),
      content: '<TABLE>\n  <TR><TD COLSPAN="2">标题</TD></TR>\n</TABLE>\n\n<!-- preserved comment -->',
      contentType: 'markdown'
    })
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['htmlBlock', 'htmlBlock'])
    expect(editor.getMarkdown()).toContain('<TD COLSPAN="2">标题</TD>')
    expect(editor.getMarkdown()).toContain('<!-- preserved comment -->')
    editor.destroy()
  })

  it('sanitizes rendered HTML blocks without changing the stored source', () => {
    const source = '<table onclick="alert(1)"><tr><td><script>alert(1)</script>安全</td></tr></table>'
    expect(sanitizeHtmlBlock(source)).not.toContain('script')
    expect(sanitizeHtmlBlock(source)).not.toContain('onclick')

    const editor = new Editor({ extensions: buildEditorExtensions(), content: source, contentType: 'markdown' })
    expect(editor.getMarkdown()).toContain('onclick="alert(1)"')
    editor.destroy()
  })

  it('removes unsafe block URLs and styles from the WYSIWYG preview', () => {
    const clean = sanitizeHtmlBlock(
      '<table style="color: red; background-image: url(javascript:x)"><tr><td><a href="javascript:alert(1)">link</a><img src="javascript:x" onerror="alert(1)"></td></tr></table>'
    )
    expect(clean).toContain('style="color: red"')
    expect(clean).not.toContain('background-image')
    expect(clean).not.toContain('javascript:')
    expect(clean).not.toContain('onerror')
  })

  it('removes dangerous tags, event attributes, and unsafe CSS URLs', () => {
    const clean = sanitizeHtmlBlock('<div><iframe src="https://evil.test"></iframe><style>body{display:none}</style><img onerror="alert(1)" style="background-image:url(https://evil.test);color: blue"></div>')
    expect(clean).not.toContain('iframe')
    expect(clean).not.toContain('style>')
    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('background-image')
    expect(clean).toContain('color: blue')
  })
})

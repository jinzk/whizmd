import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Image } from '../image'
import { typeInto } from './helpers'
import { isAbsolutePath, mediaUrlToPath, resolveRelative } from '../../utils/path'

function toMarkdown(md: string): string {
  const editor = new Editor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      Markdown.configure({ indentation: { style: 'space', size: 2 } })
    ]
  })
  editor.commands.setContent(md, { contentType: 'markdown' })
  const result = editor.getMarkdown()
  editor.destroy()
  return result
}

describe('image round-trip', () => {
  it('resolves a root-relative image path from the document directory', () => {
    expect(isAbsolutePath('/image.png')).toBe(false)
    expect(resolveRelative('C:/project', '/image.png')).toBe('C:/project/image.png')
  })

  it('decodes user-entered media URLs back to local paths', () => {
    expect(mediaUrlToPath('media://c/Users/alex/Downloads/texture4.jpg')).toBe('c:/Users/alex/Downloads/texture4.jpg')
  })
  it('turns a typed image prefix into an editable image node', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        Image.configure({ allowBase64: true }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ]
    })

    typeInto(editor, '![图片](')

    expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({
      type: 'image',
      attrs: { src: '', alt: '图片' }
    })
    editor.destroy()
  })

  it('preserves basic image', () => {
    const source = '![alt text](https://example.com/img.png)'
    const result = toMarkdown(source).trim()
    expect(result).toBe(source)
  })

  it('preserves image title', () => {
    const source = '![图](image.png "标题")'
    const result = toMarkdown(source).trim()
    expect(result).toBe(source)
  })

  it('parses a quoted image path without storing the quotes', () => {
    const editor = new Editor({ extensions: [StarterKit, Image.configure({ allowBase64: true }), Markdown.configure({ indentation: { style: 'space', size: 2 } })] })
    editor.commands.setContent('![图]("folder/my image.png")', { contentType: 'markdown' })
    expect(editor.state.doc.firstChild?.firstChild?.attrs.src).toBe('folder/my image.png')
    expect(editor.getMarkdown().trim()).toBe('![图](folder/my%20image.png)')
    editor.destroy()
  })

  it('preserves Windows absolute image paths', () => {
    const editor = new Editor({ extensions: [StarterKit, Image.configure({ allowBase64: true }), Markdown.configure({ indentation: { style: 'space', size: 2 } })] })
    editor.commands.setContent('![texture](C:/Users/alex/Downloads/texture4.jpg)', { contentType: 'markdown' })
    expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({ type: 'image', attrs: { src: 'C:/Users/alex/Downloads/texture4.jpg', alt: 'texture' } })
    editor.destroy()
  })

  it('preserves Windows absolute paths with backslashes', () => {
    const editor = new Editor({ extensions: [StarterKit, Image.configure({ allowBase64: true }), Markdown.configure({ indentation: { style: 'space', size: 2 } })] })
    editor.commands.setContent('![texture](C:\\Users\\alex\\Downloads\\texture4.jpg)', { contentType: 'markdown' })
    expect(editor.getJSON().content?.[0].content?.[0]).toMatchObject({ type: 'image', attrs: { src: 'C:\\Users\\alex\\Downloads\\texture4.jpg' } })
    editor.destroy()
  })

  it('preserves local relative path', () => {
    const source = '![pic](./assets/a.png)'
    const result = toMarkdown(source).trim()
    expect(result).toBe(source)
  })

  it('parses Typora width suffix and re-serializes', () => {
    const source = '![pic](./assets/a.png =100x200)'
    const result = toMarkdown(source).trim()
    expect(result).toBe('![pic](./assets/a.png =100)')
  })

  it('round-trips width attr from node', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        Image.configure({ allowBase64: true }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ]
    })
    editor.commands.setImage({ src: './assets/b.png', alt: 'b', width: 320 })
    const result = editor.getMarkdown()
    editor.destroy()
    expect(result).toContain('![b](./assets/b.png =320)')
  })
})

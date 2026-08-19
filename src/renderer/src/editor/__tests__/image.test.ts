import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Image } from '../image'
import { typeInto } from './helpers'

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
  it('turns a typed exclamation mark into an editable image node', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        Image.configure({ allowBase64: true }),
        Markdown.configure({ indentation: { style: 'space', size: 2 } })
      ]
    })

    typeInto(editor, '!')

    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'image',
      attrs: { src: '', alt: '' }
    })
    editor.destroy()
  })

  it('preserves basic image', () => {
    const source = '![alt text](https://example.com/img.png)'
    const result = toMarkdown(source).trim()
    expect(result).toBe(source)
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

import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'

function toMarkdown(md: string): string {
  const editor = new Editor({
    extensions: [StarterKit, Markdown.configure({ indentation: { style: 'space', size: 2 } })]
  })
  editor.commands.setContent(md, { contentType: 'markdown' })
  const result = editor.getMarkdown()
  editor.destroy()
  return result
}

describe('markdown round-trip', () => {
  it('preserves headings, emphasis and links', () => {
    const source = '# Title\n\nSome **bold** and *italic* with a [link](https://example.com).'
    const result = toMarkdown(source)
    expect(result).toContain('# Title')
    expect(result).toContain('**bold**')
    expect(result).toContain('[link](https://example.com)')
  })

  it('preserves lists and code blocks', () => {
    const source = '- a\n- b\n\n```js\nconst x = 1\n```'
    const result = toMarkdown(source)
    expect(result).toContain('- a')
    expect(result).toContain('```js')
    expect(result).toContain('const x = 1')
  })

  it('produces valid markdown for empty doc', () => {
    const result = toMarkdown('')
    expect(result.trim()).toBe('')
  })
})

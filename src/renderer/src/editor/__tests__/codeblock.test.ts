import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { MermaidCodeBlock } from '../mermaid'
import { lowlight } from '../lowlight'

function createEditor(md: string): Editor {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      MermaidCodeBlock.configure({ lowlight, defaultLanguage: 'plaintext' }),
      Markdown.configure({ indentation: { style: 'space', size: 2 } })
    ]
  })
  editor.commands.setContent(md, { contentType: 'markdown' })
  return editor
}

function toMarkdown(md: string): string {
  const editor = createEditor(md)
  const result = editor.getMarkdown()
  editor.destroy()
  return result
}

describe('code block language round-trip', () => {
  it('preserves the language tag', () => {
    const source = '```js\nconst x = 1\n```'
    const result = toMarkdown(source)
    expect(result).toContain('```js')
    expect(result).toContain('const x = 1')
  })

  it('renders without a language tag when none is specified', () => {
    const source = '```\nno language\n```'
    const result = toMarkdown(source)
    expect(result).toContain('```')
  })

  it('creates a mermaid code block node from markdown', () => {
    const editor = createEditor('```mermaid\ngraph TD\n  A-->B\n```')
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'codeBlock',
      attrs: { language: 'mermaid' }
    })
    editor.destroy()
  })
})

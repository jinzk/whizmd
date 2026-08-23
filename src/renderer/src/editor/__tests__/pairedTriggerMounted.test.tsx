import { act } from 'react'
import { render } from '@testing-library/react'
import { EditorContent } from '@tiptap/react'
import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { buildEditorExtensions } from '../extensions'
import { typeInto } from './helpers'

describe('paired trigger mounted editor', () => {
  it('handles adjacent inline syntax with React node views mounted', async () => {
    const editor = new Editor({ extensions: buildEditorExtensions() })
    const mounted = render(<EditorContent editor={editor} />)

    await act(async () => {
      typeInto(editor, '$a$*2*==1==')
      await Promise.resolve()
    })

    expect(editor.getMarkdown()).toBe('$a$*2*==1==')
    mounted.unmount()
    editor.destroy()
  })
})

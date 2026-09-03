import { Editor } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import { act } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { buildEditorExtensions } from '../extensions'
import { useEditorStore } from '../../store/editor'

const mounted: Array<{ editor: Editor; unmount: () => void }> = []

afterEach(() => {
  useEditorStore.getState().setHeadingMenu(null)
  for (const { editor, unmount } of mounted.splice(0)) {
    unmount()
    editor.destroy()
  }
  document.body.innerHTML = ''
})

async function mount(content: string): Promise<Editor> {
  const editor = new Editor({ extensions: buildEditorExtensions() })
  editor.commands.setContent(content, { contentType: 'markdown' })
  await act(async () => {
    const result = render(<EditorContent editor={editor} />)
    mounted.push({ editor, unmount: result.unmount })
    await Promise.resolve()
  })
  return editor
}

function markers(editor: Editor): string[] {
  return Array.from(editor.view.dom.querySelectorAll('.editor-heading-marker')).map(
    (el) => el.textContent ?? ''
  )
}

/** Positions of all top-level block nodes. */
function blockStarts(editor: Editor): number[] {
  const starts: number[] = []
  editor.state.doc.forEach((_node, offset) => starts.push(offset))
  return starts
}

describe('active line heading marker', () => {
  it('shows "# " when an h1 heading line is selected', async () => {
    const editor = await mount('# 标题一\n\n正文')
    // blockStarts()[0] is the h1 start; +1 puts the cursor inside its text.
    editor.commands.setTextSelection(blockStarts(editor)[0] + 1)
    await act(async () => { await Promise.resolve() })
    expect(markers(editor)).toEqual(['# '])
  })

  it('shows "## " when an h2 heading line is selected', async () => {
    const editor = await mount('# 标题一\n\n## 小节')
    editor.commands.setTextSelection(blockStarts(editor)[1] + 1)
    await act(async () => { await Promise.resolve() })
    expect(markers(editor)).toEqual(['## '])
  })

  it('shows no marker when a paragraph line is selected', async () => {
    const editor = await mount('# 标题一\n\n正文')
    // Select the trailing paragraph (last block).
    const starts = blockStarts(editor)
    editor.commands.setTextSelection(starts[starts.length - 1] + 1)
    await act(async () => { await Promise.resolve() })
    expect(markers(editor)).toEqual([])
  })

  it('opens the heading level menu when the marker is clicked', async () => {
    const editor = await mount('# 标题一\n\n## 小节')
    editor.commands.setTextSelection(blockStarts(editor)[1] + 1)
    await act(async () => { await Promise.resolve() })

    const marker = editor.view.dom.querySelector<HTMLButtonElement>('.editor-heading-marker')
    expect(marker).not.toBeNull()
    fireEvent.click(marker as HTMLButtonElement)

    const menu = useEditorStore.getState().headingMenu
    expect(menu).not.toBeNull()
    expect(menu?.level).toBe(2)
    expect(menu?.pos).toBe(blockStarts(editor)[1])
  })
})

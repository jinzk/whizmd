import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'

/**
 * Simulate typing character by character through the editor view's
 * handleTextInput, which is the exact path ProseMirror uses for real typing.
 * Returning true means an input rule consumed the keystroke.
 */
export function typeInto(editor: Editor, text: string): void {
  for (const char of text) {
    const { view, state } = editor
    const from = state.selection.from
    const to = state.selection.to
    const deflt = (): Transaction => state.tr.insertText(char, from, to)
    const handled = view.someProp('handleTextInput', (f) =>
      f(view, from, to, char, deflt)
    )
    if (!handled) {
      view.dispatch(deflt())
    }
    // Input rules can replace text with a non-text node (for example, `$$`
    // creates a block math node). Keep that node selection instead of trying
    // to place a text cursor inside a node that has no inline content.
    const selection = editor.state.selection
    if (selection.$from.parent.isTextblock) {
      editor.commands.setTextSelection(selection.from)
    }
  }
}

export function pasteInto(editor: Editor, text: string): void {
  const { view, state } = editor
  const from = state.selection.from
  const to = state.selection.to
  view.dispatch(state.tr.insertText(text, from, to))
}

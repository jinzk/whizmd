import { ReactNodeViewRenderer } from '@tiptap/react'
import { InputRule } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { TextSelection } from '@tiptap/pm/state'
import { CodeBlockNodeView } from './CodeBlockNodeView'

function codeBlockIndentAfterLine(line: string): string {
  return line.match(/^\s*/)?.[0] ?? ''
}

/**
 * Code block node whose node view renders Mermaid and HTML previews while
 * falling back to the default lowlight-highlighted rendering for every other
 * language. Configure with `{ lowlight }` at the usage site.
 */
export const CodeBlockExtension = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
    }
  },
  addInputRules() {
    return [new InputRule({
      find: /^```(plaintext|text|markdown|mermaid|javascript|typescript|python|java|c|cpp|csharp|go|rust|json|html|css|sql|bash|shell) $/i,
      handler: ({ state, range, match }) => {
        state.tr.replaceRangeWith(range.from, range.to, this.type.create({ language: match[1].toLowerCase() }))
      }
    })]
  },
  addKeyboardShortcuts() {
    const parentShortcuts = this.parent?.() ?? {}
    return {
      ...parentShortcuts,
      Enter: () => {
        const { state, view } = this.editor
        const { $from, from, to } = state.selection
        if ($from.parent.type.name === 'paragraph') {
          if ($from.parentOffset !== $from.parent.textContent.length) return false
          const match = $from.parent.textContent.match(/^```(plaintext|text|markdown|mermaid|javascript|typescript|python|java|c|cpp|csharp|go|rust|json|html|css|sql|bash|shell)$/i)
          if (!match) return false
          const node = this.type.create({ language: match[1].toLowerCase() })
          const transaction = state.tr.replaceRangeWith($from.start(), $from.end(), node)
          transaction.setSelection(TextSelection.create(transaction.doc, $from.start() + 1))
          view.dispatch(transaction)
          return true
        }
        if ($from.parent.type.name !== 'codeBlock') return false
        const lineStart = from - $from.parentOffset
        const line = state.doc.textBetween(lineStart, from, '\n')
        const indent = codeBlockIndentAfterLine(line)
        view.dispatch(state.tr.insertText(`\n${indent}`, from, to))
        return true
      },
      Tab: () => {
        const { state, view } = this.editor
        const { $from, from, to } = state.selection
        if ($from.parent.type.name !== 'codeBlock') return false

        view.dispatch(state.tr.insertText('  ', from, to))
        return true
      },
      'Shift-Tab': () => {
        const { state, view } = this.editor
        const { $from, from } = state.selection
        if ($from.parent.type.name !== 'codeBlock') return false

        const lineStart = from - $from.parentOffset
        const lineBeforeCursor = state.doc.textBetween(lineStart, from, '\n')
        const leadingWhitespace = lineBeforeCursor.match(/^\s*/)?.[0] ?? ''
        const removeLength = Math.min(2, leadingWhitespace.length)
        if (removeLength > 0) view.dispatch(state.tr.delete(lineStart, lineStart + removeLength))
        return true
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView, {
      selectedOnTextSelection: true
    })
  }
})

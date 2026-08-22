import { ReactNodeViewRenderer } from '@tiptap/react'
import { InputRule } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
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
    return [
      new InputRule({
        find: /^```([\w-]*) $/,
        handler: ({ state, range, match }) => {
          const language = match[1] || 'plaintext'
          const nodeType = this.type
          state.tr.replaceRangeWith(range.from, range.to, nodeType.create({ language }))
        }
      }),
      ...(this.parent?.() ?? [])
    ]
  },
  addKeyboardShortcuts() {
    return {
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
        if (removeLength > 0) {
          view.dispatch(state.tr.delete(lineStart, lineStart + removeLength))
        }
        return true
      },
      Enter: () => {
        const { state, view } = this.editor
        const { $from, from, to } = state.selection
        if ($from.parent.type.name !== 'codeBlock') return false

        const lineStart = from - $from.parentOffset
        const line = state.doc.textBetween(lineStart, from, '\n')
        const indent = codeBlockIndentAfterLine(line)
        view.dispatch(state.tr.insertText(`\n${indent}`, from, to))
        return true
      }
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView, {
      selectedOnTextSelection: true
    })
  }
})

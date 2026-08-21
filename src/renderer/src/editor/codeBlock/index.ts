import { ReactNodeViewRenderer } from '@tiptap/react'
import { InputRule } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { CodeBlockNodeView } from './CodeBlockNodeView'

function isInsideTable(state: EditorState, pos: number): boolean {
  const resolved = state.doc.resolve(pos)
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    const name = resolved.node(depth).type.name
    if (name === 'tableCell' || name === 'tableHeader') {
      return true
    }
  }
  return false
}

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
      htmlEditing: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-html-editing') === 'true',
        renderHTML: (attributes: { htmlEditing?: boolean }) =>
          attributes.htmlEditing ? { 'data-html-editing': 'true' } : {}
      },
      htmlPreview: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-html-preview') === 'true',
        renderHTML: (attributes: { htmlPreview?: boolean }) =>
          attributes.htmlPreview ? { 'data-html-preview': 'true' } : {}
      }
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
      new InputRule({
        find: /^<$/,
        handler: ({ state, range }) => {
          if (isInsideTable(state, range.from)) return
           const transaction = state.tr.replaceRangeWith(
             range.from,
             range.to,
             this.type.create(
                { language: 'html', htmlPreview: true, htmlEditing: true },
               this.type.schema.text('<')
             )
           )
           transaction.setSelection(TextSelection.near(transaction.doc.resolve(range.from + 2)))
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

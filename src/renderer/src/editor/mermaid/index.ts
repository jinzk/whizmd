import { ReactNodeViewRenderer } from '@tiptap/react'
import { InputRule } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { MermaidNodeView } from './MermaidNodeView'

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

/**
 * Code block node whose node view renders a Mermaid preview for
 * `language === "mermaid"` and falls back to the default lowlight-highlighted
 * rendering for every other language. Configure with `{ lowlight }` at the
 * usage site (see extensions.ts).
 */
export const MermaidCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
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
               { language: 'html', htmlPreview: true },
               this.type.schema.text('<')
             )
           )
           transaction.setSelection(TextSelection.near(transaction.doc.resolve(range.from + 2)))
        }
      }),
      ...(this.parent?.() ?? [])
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView, {
      selectedOnTextSelection: true
    })
  }
})

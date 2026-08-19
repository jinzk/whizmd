import { ReactNodeViewRenderer } from '@tiptap/react'
import { InputRule } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { MermaidNodeView } from './MermaidNodeView'

/**
 * Code block node whose node view renders a Mermaid preview for
 * `language === "mermaid"` and falls back to the default lowlight-highlighted
 * rendering for every other language. Configure with `{ lowlight }` at the
 * usage site (see extensions.ts).
 */
export const MermaidCodeBlock = CodeBlockLowlight.extend({
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
  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView, {
      selectedOnTextSelection: true
    })
  }
})

import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { isInCodeBlock } from './input/context'

/** Parse plain-text clipboard content as Markdown before inserting it. */
export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        handlePaste: (view, event) => {
          if (isInCodeBlock(view.state, view.state.selection.from)) return false
          const text = event.clipboardData?.getData('text/plain')
          if (!text) return false
          this.editor.commands.insertContent(text, { contentType: 'markdown' })
          return true
        }
      }
    })]
  }
})

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const ACTIVE_LINE_KEY = new PluginKey('activeLine')

/**
 * Highlights the block node (paragraph, heading, list item, code block, ...)
 * that currently contains the selection — the "current editing line".
 */
export const ActiveLine = Extension.create({
  name: 'activeLine',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: ACTIVE_LINE_KEY,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, oldState) {
            // No selection or document change → keep the existing decoration.
            if (!tr.selectionSet && !tr.docChanged) {
              return oldState
            }

            const { $from } = tr.selection

            // Walk up to the nearest textblock ancestor of the cursor.
            let depth = $from.depth
            while (depth > 0 && !$from.node(depth).isTextblock) {
              depth -= 1
            }
            if (depth === 0) {
              return DecorationSet.empty
            }

            const node = $from.node(depth)
            const pos = $from.before(depth)
            return DecorationSet.create(tr.doc, [
              Decoration.node(pos, pos + node.nodeSize, {
                class: 'editor-line-active'
              })
            ])
          }
        },
        props: {
          decorations(state) {
            return ACTIVE_LINE_KEY.getState(state)
          }
        }
      })
    ]
  }
})
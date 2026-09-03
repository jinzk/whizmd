import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useEditorStore } from '../store/editor'

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
            const decorations: Decoration[] = [
              Decoration.node(pos, pos + node.nodeSize, {
                class: 'editor-line-active'
              })
            ]
            if (node.type.name === 'heading') {
              const level = Math.min(6, Math.max(1, Number(node.attrs.level ?? 1)))
              const marker = document.createElement('button')
              marker.type = 'button'
              marker.className = 'editor-heading-marker'
              marker.title = '切换标题级别'
              marker.textContent = '#'.repeat(level) + ' '
              marker.addEventListener('mousedown', (event) => event.preventDefault())
              marker.addEventListener('click', (event) => {
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                useEditorStore.getState().setHeadingMenu({
                  pos,
                  level,
                  top: rect.top,
                  left: rect.left
                })
              })
              decorations.push(Decoration.widget(pos + 1, marker, { side: -1 }))
            }
            return DecorationSet.create(tr.doc, decorations)
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
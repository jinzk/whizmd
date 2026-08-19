import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const syntaxSourceKey = new PluginKey<{ decorations: DecorationSet; focused: boolean }>('syntaxSource')
const focusMetaKey = new PluginKey('syntaxSourceFocus')
const MARK_SYNTAX: Record<string, { open: string; close: string }> = {
  bold: { open: '**', close: '**' },
  italic: { open: '*', close: '*' },
  code: { open: '`', close: '`' },
  strike: { open: '~~', close: '~~' }
}

function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = []

  state.doc.descendants((node, position) => {
    if (!node.isText || !node.marks?.length) return

    const syntax = node.marks
      .map((mark) => MARK_SYNTAX[mark.type.name])
      .filter((value): value is { open: string; close: string } => Boolean(value))
    if (syntax.length === 0) return

    decorations.push(
      Decoration.inline(position, position + node.nodeSize, {
        class: 'syntax-source-mark',
        'data-syntax-open': syntax.map((value) => value.open).join(''),
        'data-syntax-close': syntax
          .map((value) => value.close)
          .reverse()
          .join('')
      })
    )
  })

  return DecorationSet.create(state.doc, decorations)
}

export const SyntaxSource = Extension.create({
  name: 'syntaxSource',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: syntaxSourceKey,
        state: {
          init: () => ({ decorations: DecorationSet.empty, focused: false }),
          apply: (transaction, value, _oldState, newState) => {
            const focusMeta = transaction.getMeta(focusMetaKey) as boolean | undefined
            const focused = focusMeta !== undefined ? focusMeta : value.focused
            const decorations = focused ? buildDecorations(newState) : DecorationSet.empty
            return { decorations, focused }
          }
        },
        props: {
          decorations: (state) => syntaxSourceKey.getState(state)?.decorations ?? DecorationSet.empty
        },
        view(view) {
          const update = (focused: boolean): void => {
            view.dispatch(view.state.tr.setMeta(focusMetaKey, focused))
          }
          const onFocus = (): void => update(true)
          const onBlur = (): void => update(false)
          view.dom.addEventListener('focus', onFocus)
          view.dom.addEventListener('blur', onBlur)
          return {
            destroy() {
              view.dom.removeEventListener('focus', onFocus)
              view.dom.removeEventListener('blur', onBlur)
            }
          }
        }
      })
    ]
  }
})

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { Editor } from '@tiptap/core'
import { EditorView } from '@codemirror/view'
import { useEditorStore } from '../store/editor'
import { useDocumentOutline } from '../hooks/useDocumentOutline'
import { useI18n } from '../i18n'

interface Props {
  editor?: Editor | null
  content: string
  sourceView?: RefObject<EditorView | null>
}

export function OutlinePanel({ editor = null, content, sourceView }: Props): React.JSX.Element {
  const { t } = useI18n()
  const storeEditor = useEditorStore((s) => s.wysiwygEditor)
  const storeView = useEditorStore((s) => s.sourceEditorView)
  const liveEditor = storeEditor ?? editor
  const liveView = storeView ?? sourceView?.current ?? null
  const outline = useDocumentOutline(liveEditor, content)
  const [activePath, setActivePath] = useState<number | null>(null)

  useEffect(() => {
    if (!liveEditor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePath(null)
      return
    }
    const onSelection = (): void => {
      const $from = liveEditor.state.selection.$from
      let path = -1
      for (let i = $from.depth; i > 0; i -= 1) {
        if ($from.node(i).type.name === 'heading') {
          path = $from.before(i)
          break
        }
      }
      setActivePath(path === -1 ? null : path)
    }
    onSelection()
    liveEditor.on('selectionUpdate', onSelection)
    return () => {
      liveEditor.off('selectionUpdate', onSelection)
    }
  }, [liveEditor])

  const scrollHeadingIntoView = (node: Node): void => {
    let target: Node | null = node
    while (target && !(target instanceof Element && /^H[1-6]$/i.test(target.tagName))) {
      target = target.parentNode
    }
    ;(target as Element | null)?.scrollIntoView?.({ block: 'center' })
  }

  const goTo = (entry: (typeof outline)[number]): void => {
    if (liveEditor) {
      if (entry.pos === null) return
      const view = liveEditor.view
      liveEditor.chain().focus().setTextSelection(entry.pos).run()
      const node = view.nodeDOM(entry.pos) ?? view.domAtPos(entry.pos).node
      scrollHeadingIntoView(node)
      return
    }
    const view = liveView
    if (!view || entry.line === null) return
    const line = view.state.doc.line(Math.min(entry.line, view.state.doc.lines))
    view.focus()
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' })
    })
  }

  if (outline.length === 0) {
    return <p className="sidebar-empty">{t('outlineEmpty')}</p>
  }

  return (
    <div className="outline-panel">
      {outline.map((entry, index) => (
        <button
          key={`${entry.pos ?? entry.line ?? index}-${entry.level}-${entry.text}`}
          type="button"
          className={`outline-item level-${entry.level} ${liveEditor && activePath === entry.pos ? 'active' : ''}`}
          style={{ paddingLeft: `${8 + (entry.level - 1) * 14}px` }}
          onClick={() => goTo(entry)}
          title={entry.text}
        >
          {entry.text || t('untitled')}
        </button>
      ))}
    </div>
  )
}

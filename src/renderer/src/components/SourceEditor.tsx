import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete'
import { startCompletion } from '@codemirror/autocomplete'
import { markdown as markdownLang } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { Annotation, Compartment, EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentUnit, indentOnInput } from '@codemirror/language'
import { insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown'
import { indentWithTab, insertTab, indentLess } from '@codemirror/commands'
import type { EffectiveTheme } from '../hooks/useTheme'
import { useEditorStore } from '../store/editor'

const themeCompartment = new Compartment()
const externalSync = Annotation.define<boolean>()

const CODE_LANGUAGES = [
  { label: 'mermaid', detail: '流程图 / 时序图 / 类图' },
  { label: 'javascript', detail: 'JavaScript' },
  { label: 'typescript', detail: 'TypeScript' },
  { label: 'python', detail: 'Python' },
  { label: 'java', detail: 'Java' },
  { label: 'c', detail: 'C' },
  { label: 'cpp', detail: 'C++' },
  { label: 'csharp', detail: 'C#' },
  { label: 'go', detail: 'Go' },
  { label: 'rust', detail: 'Rust' },
  { label: 'json', detail: 'JSON' },
  { label: 'html', detail: 'HTML' },
  { label: 'css', detail: 'CSS' },
  { label: 'sql', detail: 'SQL' },
  { label: 'bash', detail: 'Shell' },
  { label: 'plaintext', detail: '纯文本' }
]

function languageCompletion(context: CompletionContext) {
  const line = context.state.doc.lineAt(context.pos)
  const before = line.text.slice(0, context.pos - line.from)
  const match = before.match(/^```([\w-]*)$/)
  if (!match) {
    return null
  }
  return {
    from: line.from + 3,
    options: CODE_LANGUAGES,
    validFor: /^[\w-]*$/
  }
}

interface Props {
  content: string
  onUpdate: (markdown: string) => void
  theme: EffectiveTheme
}

export function SourceEditor({ content, onUpdate, theme }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onUpdateRef = useRef(onUpdate)
  const setDirtyRef = useRef<() => void>(() => {})
  const initialContentRef = useRef(content)
  const setDirty = useEditorStore((s) => s.setDirty)

  useEffect(() => {
    onUpdateRef.current = onUpdate
    setDirtyRef.current = () => setDirty(true)
  }, [onUpdate, setDirty])

  useEffect(() => {
    if (!hostRef.current) return

    const state = EditorState.create({
      doc: initialContentRef.current,
      extensions: [
          basicSetup,
          autocompletion({
            override: [languageCompletion],
            activateOnTyping: true,
            defaultKeymap: true
          }),
           markdownLang({ addKeymap: false }),
           indentUnit.of('  '),
           indentOnInput(),
           keymap.of([
             { key: 'Enter', run: insertNewlineContinueMarkup },
             { key: 'Backspace', run: deleteMarkupBackward },
             indentWithTab,
             { key: 'Shift-Tab', run: indentLess },
             { key: 'Tab', run: insertTab }
           ]),
         themeCompartment.of(theme === 'dark' ? oneDark : []),
         EditorView.updateListener.of((update) => {
           const isExternalSync = update.transactions.some((tr) =>
             tr.annotation(externalSync)
           )
            if (update.docChanged && !isExternalSync) {
              onUpdateRef.current(update.state.doc.toString())
              setDirtyRef.current()
              const line = update.state.doc.lineAt(update.state.selection.main.head)
              if (/^```$/.test(line.text)) {
                startCompletion(view)
              }
            }
        })
      ]
    })

    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When switching back INTO source mode, sync the latest markdown from the
  // store snapshot, unless the content is identical (e.g. fresh mount).
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (initialContentRef.current === content) {
      initialContentRef.current = content
      return
    }
    const current = view.state.doc.toString()
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content },
        annotations: externalSync.of(true)
      })
    }
  }, [content])

  // Swap the CodeMirror theme when the effective theme changes.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.reconfigure(theme === 'dark' ? oneDark : [])
    })
  }, [theme])

  return <div className="source-editor" ref={hostRef} />
}

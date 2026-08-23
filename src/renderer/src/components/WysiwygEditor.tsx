import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '../editor/extensions'
import { useI18n } from '../i18n'
import { insertDroppedImages, insertPastedImages, isImageFile } from '../editor/image/insert'

interface Props {
  content: string
  onUpdate: (markdown: string) => void
  spellCheck?: boolean
}

const CODE_LANGUAGES = [
  ['mermaid', 'Mermaid 图表'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['csharp', 'C#'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['json', 'JSON'],
  ['markdown', 'Markdown'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['sql', 'SQL'],
  ['bash', 'Shell'],
  ['shell', 'Shell'],
  ['plaintext', '纯文本'],
  ['text', '纯文本']
] as const

export function WysiwygEditor({ content, onUpdate, spellCheck = false }: Props): React.JSX.Element {
  const { t } = useI18n()
  const editorRef = useRef<Editor | null>(null)
  const [extensions] = useState(buildEditorExtensions)
  const lastEmittedRef = useRef<string | null>(null)
  const onUpdateRef = useRef(onUpdate)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [activeLanguageIndex, setActiveLanguageIndex] = useState(0)
  const [languageQuery, setLanguageQuery] = useState('')
  const [languageMenuPosition, setLanguageMenuPosition] = useState({ top: 0, left: 0 })
  const languageMenuRef = useRef<HTMLDivElement>(null)

  const syncLanguageMenu = (instance: Editor): void => {
    const { $from } = instance.state.selection
    const currentLine = $from.parent.textContent
    const shouldShow =
      $from.parent.type.name === 'paragraph' &&
      $from.parentOffset === currentLine.length &&
      currentLine.startsWith('```') &&
      !currentLine.includes('\n')

    setShowLanguageMenu(shouldShow)
    const query = shouldShow ? currentLine.slice(3).trim().toLowerCase() : ''
    setLanguageQuery(query)
    setActiveLanguageIndex(0)
    if (!shouldShow) {
      return
    }

    try {
      const coords = instance.view.coordsAtPos(instance.state.selection.from)
      const menuWidth = 230
      const menuHeight = 330
      const spaceBelow = window.innerHeight - coords.bottom - 8
      const top =
        spaceBelow >= menuHeight ? coords.bottom + 8 : Math.max(8, coords.top - menuHeight - 8)
      setLanguageMenuPosition({
        top,
        left: Math.max(8, Math.min(coords.left, window.innerWidth - menuWidth - 8))
      })
    } catch {
      // The view may not have been laid out yet.
    }
  }

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  const editor = useEditor({
    extensions,
    content,
    contentType: 'markdown',
    autofocus: 'start',
    onCreate: ({ editor }) => {
      editorRef.current = editor
      lastEmittedRef.current = editor.getMarkdown()
    },
    onUpdate: ({ editor }) => {
      syncLanguageMenu(editor)
      const md = editor.getMarkdown()
      if (md === lastEmittedRef.current) return
      lastEmittedRef.current = md
      onUpdateRef.current(md)
    },
    onBlur: () => undefined,
    onDestroy: () => {
      editorRef.current = null
    },
    editorProps: {
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) {
          return false
        }
        const files = Array.from(event.dataTransfer?.files ?? [])
        const images = files.filter(isImageFile)
        if (images.length === 0) {
          return false
        }
        event.preventDefault()
        if (editorRef.current) {
          void insertDroppedImages(editorRef.current, images)
        }
        return true
      },
      handlePaste: (_view, event) => {
        const items = Array.from(event.clipboardData?.items ?? [])
        const hasImage = items.some(
          (item) => item.kind === 'file' && item.type.startsWith('image/')
        )
        if (!hasImage || !editorRef.current) {
          return false
        }
        event.preventDefault()
        void insertPastedImages(editorRef.current, items)
        return true
      },
      handleKeyDown: (_view, event) => {
        if (event.key !== 'Tab' || !showLanguageMenu) return false
        event.preventDefault()
        setActiveLanguageIndex(0)
        languageMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
        return true
      }
    }
  })

  useEffect(() => {
    if (!editor) return
    const onSelectionUpdate = (): void => syncLanguageMenu(editor)
    editor.on('selectionUpdate', onSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate)
    }
  }, [editor])

  useEffect(() => {
    if (!editor || !showLanguageMenu) return
    const reposition = (): void => syncLanguageMenu(editor)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [editor, showLanguageMenu])

  const chooseLanguageByIndex = (index: number): void => {
    const language = filteredCodeLanguages[index]?.[0]
    if (language) chooseLanguage(language)
  }

  const filteredCodeLanguages = CODE_LANGUAGES.filter(([language]) => language.startsWith(languageQuery))

  const focusLanguageOption = (index: number): void => {
    setActiveLanguageIndex(index)
    const options = languageMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    options?.[index]?.focus()
  }

  const handleLanguageMenuKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    const currentIndex = Number((event.currentTarget as HTMLElement).getAttribute('data-language-index') ?? activeLanguageIndex)
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      if (filteredCodeLanguages.length) focusLanguageOption((currentIndex + 1) % filteredCodeLanguages.length)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      if (filteredCodeLanguages.length) focusLanguageOption((currentIndex - 1 + filteredCodeLanguages.length) % filteredCodeLanguages.length)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      chooseLanguageByIndex(currentIndex)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setShowLanguageMenu(false)
    }
  }

  const chooseLanguage = (language: string): void => {
    if (!editor) return
    const { $from } = editor.state.selection
    const from = $from.start()
    const to = $from.end()
    editor.chain().focus().deleteRange({ from, to }).setCodeBlock({ language }).run()
    setShowLanguageMenu(false)
  }

  // Push externally supplied markdown (e.g. switching from source mode or
  // opening a file) into the editor only when it did not originate from this
  // editor itself. Content that the editor already emitted is never pushed
  // back, so typing never triggers a reset of the document or cursor.
  useEffect(() => {
    if (!editor) return
    if (content === lastEmittedRef.current) return
    lastEmittedRef.current = content
    editor.commands.setContent(content, { emitUpdate: false, contentType: 'markdown' })
  }, [content, editor])

  return (
    <div className="wysiwyg-editor">
       <EditorContent editor={editor} spellCheck={spellCheck} />
      {editor && showLanguageMenu ? (
        <div
          className="code-language-menu"
          ref={languageMenuRef}
          role="listbox"
          onKeyDown={handleLanguageMenuKeyDown}
          aria-label={t('chooseCodeLanguage')}
          style={{ top: languageMenuPosition.top, left: languageMenuPosition.left }}
        >
          <div className="code-language-title">{t('chooseCodeLanguage')}</div>
           {filteredCodeLanguages.map(([language, label], index) => (
             <button
              key={language}
              type="button"
               role="option"
               tabIndex={index === activeLanguageIndex ? 0 : -1}
               aria-selected={index === activeLanguageIndex}
               data-language-index={index}
               onFocus={() => setActiveLanguageIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseLanguage(language)}
            >
              <code>{language}</code>
              <span>
                {language === 'mermaid'
                  ? t('mermaid')
                  : language === 'plaintext'
                    ? t('plaintext')
                    : label}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

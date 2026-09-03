import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { useEditorStore } from '../store/editor'
import { buildEditorExtensions } from '../editor/extensions'
import { insertDroppedImages, insertPastedImages, insertImageFromDialog, isImageFile } from '../editor/image/insert'
import { CodeLanguageMenu } from './CodeLanguageMenu'
import { HeadingLevelMenu } from './HeadingLevelMenu'
import { useWysiwygContent } from './useWysiwygContent'
import { EditorContextMenu, type EditorInsertAction } from './EditorContextMenu'
import { useI18n } from '../i18n'

interface Props {
  content: string
  onUpdate: (markdown: string) => void
  spellCheck?: boolean
  onInsertAction?: (action: EditorInsertAction) => void
  onEditorReady?: (editor: Editor) => void
  onEditorDestroy?: () => void
}

export function WysiwygEditor({ content, onUpdate, spellCheck = false, onInsertAction, onEditorReady, onEditorDestroy }: Props): React.JSX.Element {
  const editorRef = useRef<Editor | null>(null)
  const { t } = useI18n()
  const [extensions] = useState(buildEditorExtensions)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [languageQuery, setLanguageQuery] = useState('')
  const [languageMenuPosition, setLanguageMenuPosition] = useState({ top: 0, left: 0 })
  const languageMenuRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ left: number; top: number } | null>(null)
  const headingMenu = useEditorStore((state) => state.headingMenu)
  const headingMenuRef = useRef<HTMLDivElement>(null)

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

  const { initialize, emit, sync } = useWysiwygContent(content, onUpdate)

  const handleInsertAction = (action: EditorInsertAction): void => {
    if (!editor) return
    if (action === 'image') {
      void insertImageFromDialog(editor)
    } else if (action === 'link') {
      editor.commands.insertContent({ type: 'linkNode', attrs: { text: '', href: '', reference: null } })
    } else if (action === 'imageLink') {
      editor.commands.insertContent({ type: 'imageLinkNode', attrs: { src: '', alt: '', title: null, href: '', reference: null } })
    } else if (action === 'table') {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    } else if (action === 'codeBlock') {
      editor.chain().focus().setCodeBlock({ language: 'plaintext' }).run()
    } else {
      onInsertAction?.(action)
    }
  }

  const editor = useEditor({
    extensions,
    content,
    contentType: 'markdown',
    autofocus: 'start',
    onCreate: ({ editor }) => {
       editorRef.current = editor
       onEditorReady?.(editor)
       initialize(editor)
    },
    onUpdate: ({ editor }) => {
      syncLanguageMenu(editor)
       emit(editor)
    },
    onBlur: () => undefined,
    onDestroy: () => {
      editorRef.current = null
      onEditorDestroy?.()
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
        languageMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
        return true
      }
    }
  })

  useEffect(() => {
    useEditorStore.getState().setWysiwygEditor(editor)
    return () => {
      useEditorStore.getState().setWysiwygEditor(null)
    }
  }, [editor])

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

  useEffect(() => { sync(editor) }, [editor, sync])

  useEffect(() => {
    if (!headingMenu) return
    const onPointerDown = (event: MouseEvent): void => {
      if (headingMenuRef.current && !headingMenuRef.current.contains(event.target as Node)) {
        useEditorStore.getState().setHeadingMenu(null)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') useEditorStore.getState().setHeadingMenu(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [headingMenu])

  return (
    <div className="wysiwyg-editor" onContextMenu={(event) => { event.preventDefault(); setContextMenu({ left: event.clientX, top: event.clientY }) }}>
       <EditorContent editor={editor} spellCheck={spellCheck} />
      {editor && showLanguageMenu ? (
        <CodeLanguageMenu editor={editor} query={languageQuery} position={languageMenuPosition} menuRef={languageMenuRef} onClose={() => setShowLanguageMenu(false)} />
      ) : null}
      {editor && headingMenu ? (
        <HeadingLevelMenu editor={editor} pos={headingMenu.pos} level={headingMenu.level} position={{ top: headingMenu.top, left: headingMenu.left }} menuRef={headingMenuRef} onClose={() => useEditorStore.getState().setHeadingMenu(null)} />
      ) : null}
      {contextMenu ? <EditorContextMenu position={contextMenu} onClose={() => setContextMenu(null)} onAction={handleInsertAction} labels={{ image: t('insertImage'), link: t('insertLink'), imageLink: t('insertImageLink'), table: t('insertTable'), codeBlock: t('insertCodeBlock') }} /> : null}
    </div>
  )
}

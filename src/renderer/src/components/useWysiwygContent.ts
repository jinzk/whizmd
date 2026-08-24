import { useCallback, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/core'

export function useWysiwygContent(content: string, onUpdate: (markdown: string) => void) {
  const lastEmittedRef = useRef<string | null>(null)
  const onUpdateRef = useRef(onUpdate)

  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  const initialize = useCallback((instance: Editor): void => {
    lastEmittedRef.current = instance.getMarkdown()
  }, [])

  const emit = useCallback((instance: Editor): void => {
    const markdown = instance.getMarkdown()
    if (markdown === lastEmittedRef.current) return
    lastEmittedRef.current = markdown
    onUpdateRef.current(markdown)
  }, [])

  const sync = useCallback((editor: Editor | null): void => {
    if (!editor || content === lastEmittedRef.current) return
    lastEmittedRef.current = content
    editor.commands.setContent(content, { emitUpdate: false, contentType: 'markdown' })
  }, [content])

  return { initialize, emit, sync }
}

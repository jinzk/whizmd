import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'

export interface OutlineEntry {
  level: number
  text: string
  pos: number | null
  line: number | null
}

function fromSource(content: string): OutlineEntry[] {
  const entries: OutlineEntry[] = []
  const re = /^(#{1,6})\s+(.+?)\s*$/gm
  for (const match of content.matchAll(re)) {
    const index = match.index ?? 0
    const line = content.slice(0, index).split('\n').length
    entries.push({ level: match[1].length, text: match[2].trim(), pos: null, line })
  }
  return entries
}

function fromDoc(editor: Editor): OutlineEntry[] {
  const entries: OutlineEntry[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      entries.push({
        level: Number(node.attrs.level ?? 1),
        text: node.textContent,
        pos,
        line: null
      })
    }
  })
  return entries
}

export function useDocumentOutline(editor: Editor | null, content: string): OutlineEntry[] {
  const [outline, setOutline] = useState<OutlineEntry[]>([])

  useEffect(() => {
    if (!editor) {
      // The source outline derives from the raw markdown string.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOutline(fromSource(content))
      return
    }

    const sync = (): void => {
      setOutline(fromDoc(editor))
    }
    sync()
    editor.on('update', sync)
    return () => {
      editor.off('update', sync)
    }
  }, [editor, content])

  return outline
}

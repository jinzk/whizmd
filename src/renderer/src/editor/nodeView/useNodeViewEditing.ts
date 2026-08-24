import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'

export function useNodeViewEditing(
  editor: Editor,
  getPos: () => number | undefined,
  nodeSize: number,
  initiallyEditing: boolean
) {
  const [editing, setEditing] = useState(initiallyEditing)

  useEffect(() => {
    if (!editing) return
    const update = (): void => {
      const position = getPos()
      if (position === undefined) return
      const selection = editor.state.selection
      if (selection.from <= position || selection.from >= position + nodeSize) setEditing(false)
    }
    editor.on('selectionUpdate', update)
    return () => { editor.off('selectionUpdate', update) }
  }, [editing, editor, getPos, nodeSize])

  return { editing, setEditing }
}

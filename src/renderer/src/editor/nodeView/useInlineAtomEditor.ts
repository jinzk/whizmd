import { useEffect, useRef, useState } from 'react'

type InlineAtomEditorOptions = {
  value: string
  onCommit: (value: string) => void
  onDelete: () => void
}

export function useInlineAtomEditor({ value: sourceValue, onCommit, onDelete }: InlineAtomEditorOptions) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(sourceValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Reset the draft when the atom changes outside the active edit session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setValue(sourceValue)
  }, [editing, sourceValue])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = (): void => {
    const next = value.trim()
    if (!next) onDelete()
    else {
      onCommit(next)
      setEditing(false)
    }
  }

  const cancel = (): void => {
    setValue(sourceValue)
    setEditing(false)
  }

  return { editing, setEditing, value, setValue, inputRef, commit, cancel }
}

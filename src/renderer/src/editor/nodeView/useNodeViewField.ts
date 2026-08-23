import { useEffect, useState } from 'react'

export function useNodeViewField(source: string, onCommit: (value: string) => void, options: { commitOnChange?: boolean } = {}) {
  const [value, setValue] = useState(source)

  useEffect(() => {
    // NodeView attributes are the source of truth after external transactions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(source)
  }, [source])

  const change = (next: string): void => {
    setValue(next)
    if (options.commitOnChange !== false) onCommit(next)
  }
  const commit = (): void => onCommit(value)
  const cancel = (): void => setValue(source)
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  return { value, setValue, change, commit, cancel, onKeyDown }
}

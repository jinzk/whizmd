import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import { referenceEntry } from '../referenceRegistry'
import type { ReferenceEntry } from '../referenceRegistry'
import { createReferenceDefinition, jumpToReferenceDefinition } from './referenceCommands'

type ReferenceStatusProps = {
  editor: Editor
  id: string
  entry: ReferenceEntry | undefined
}

export function ReferenceStatus({ editor, id, entry }: ReferenceStatusProps): React.JSX.Element {
  const [, refresh] = useState(0)
  useEffect(() => {
    const onTransaction = (): void => refresh((value) => value + 1)
    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction) }
  }, [editor])
  entry = referenceEntry(editor, id)
  const isDefined = entry?.definitionPosition !== null && entry?.definitionPosition !== undefined
  const isDuplicate = (entry?.duplicateDefinitionPositions.length ?? 0) > 0
  const isIncomplete = isDefined && !entry?.destination.trim()
  const status = !entry || !isDefined ? '未定义' : isDuplicate ? `重复定义（${entry.duplicateDefinitionPositions.length + 1} 个）` : isIncomplete ? '定义未完成' : '已定义'

  return (
    <span className={`reference-status reference-status-${!isDefined ? 'missing' : isDuplicate ? 'duplicate' : 'defined'}`}>
      引用 {id}：{status}
      {!isDefined ? (
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => createReferenceDefinition(editor, id)}>
          创建定义
        </button>
      ) : (
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => jumpToReferenceDefinition(editor, id)}>
          跳转定义
        </button>
      )}
    </span>
  )
}

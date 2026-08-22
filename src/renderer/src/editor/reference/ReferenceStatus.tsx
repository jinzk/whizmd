import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import { referenceEntry } from '../referenceRegistry'
import type { ReferenceEntry } from '../referenceRegistry'
import { createReferenceDefinition, jumpToReferenceDefinition } from './referenceCommands'
import { useI18n } from '../../i18n'

type ReferenceStatusProps = {
  editor: Editor
  id: string
  entry: ReferenceEntry | undefined
}

export function ReferenceStatus({ editor, id, entry }: ReferenceStatusProps): React.JSX.Element {
  const { t } = useI18n()
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
  const status = !entry || !isDefined
    ? t('undefinedReference')
    : isDuplicate
      ? t('duplicateReference', { count: String(entry.duplicateDefinitionPositions.length + 1) })
      : isIncomplete
        ? t('incompleteReference')
        : t('definedReference')

  return (
    <span className={`reference-status reference-status-${!isDefined ? 'missing' : isDuplicate ? 'duplicate' : 'defined'}`}>
      {t('reference')} {id}: {status}
      {!isDefined ? (
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => createReferenceDefinition(editor, id)}>
           {t('createDefinition')}
        </button>
      ) : (
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => jumpToReferenceDefinition(editor, id)}>
           {t('jumpToDefinition')}
        </button>
      )}
    </span>
  )
}

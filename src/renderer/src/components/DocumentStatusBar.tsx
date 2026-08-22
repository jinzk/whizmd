import type { Mode } from '../store/editor'
import type { SaveStatus } from '../hooks/useDocumentActions'
import { useI18n } from '../i18n'

interface Props {
  mode: Mode
  dirty: boolean
  saveStatus: SaveStatus
  lineCount: number
  characterCount: number
}

export function DocumentStatusBar({ mode, dirty, saveStatus, lineCount, characterCount }: Props): React.JSX.Element {
  const { t } = useI18n()
  return (
    <footer className="status-bar" aria-label={t('documentStatus')}>
      <span className="status-mode">{mode === 'wysiwyg' ? t('edit') : t('source')}</span>
      <span>{t('lineCount', { count: String(lineCount) })}</span>
      <span>{t('characterCount', { count: String(characterCount) })}</span>
      <span className="status-save" data-status={dirty ? 'dirty' : saveStatus}>
        {dirty ? t('unsavedChanges') : saveStatus === 'saving' ? t('saving') : saveStatus === 'error' ? t('saveError') : t('saved')}
      </span>
    </footer>
  )
}

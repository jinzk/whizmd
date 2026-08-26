import type { Mode } from '../store/editor'
import { useI18n } from '../i18n'
import type { SaveStatus } from '../hooks/useDocumentActions'

function ToolbarIcon({ type }: { type: 'new' | 'save' }): React.JSX.Element {
  return type === 'new' ? (
    <svg className="toolbar-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 2.75h7l4.25 4.25v10.25H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M11 2.75V7h4.25M10 10v5M7.5 12.5h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg className="toolbar-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3.25 3.25h11l2.5 2.5v11H3.25z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M6 3.5v5h7v-5M6.25 16.75v-4.5h7.5v4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
  )
}

function SettingsIcon(): React.JSX.Element {
  return <svg className="toolbar-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M8.3 2.8h3.4l.45 1.85c.38.16.74.37 1.06.62l1.8-.63 1.7 2.95-1.35 1.34c.04.22.06.45.06.68s-.02.46-.06.68l1.35 1.34-1.7 2.95-1.8-.63c-.32.25-.68.46-1.06.62l-.45 1.85H8.3l-.45-1.85a5.8 5.8 0 0 1-1.06-.62l-1.8.63-1.7-2.95 1.35-1.34A4 4 0 0 1 4.58 9.6c0-.23.02-.46.06-.68L3.29 7.59l1.7-2.95 1.8.63c.32-.25.68-.46 1.06-.62z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><circle cx="10" cy="9.6" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
}

interface Props {
  mode: Mode
  docTitle: string
  dirty: boolean
  saveStatus: SaveStatus
  onNew: () => void
  onSave: () => void
  onModeChange: (mode: Mode) => void
  onSettings: () => void
  onDrawGeometry: () => void
}

export function AppToolbar({ mode, docTitle, dirty, saveStatus, onNew, onSave, onModeChange, onSettings, onDrawGeometry }: Props): React.JSX.Element {
  const { t } = useI18n()
  return <header className="toolbar">
    <div className="toolbar-left">
      <button type="button" onClick={onNew}><ToolbarIcon type="new" />{t('newFile')}</button>
      <button type="button" onClick={onSave} disabled={saveStatus === 'saving'}><ToolbarIcon type="save" />{saveStatus === 'saving' ? t('saving') : t('save')}</button>
      <button type="button" onClick={onDrawGeometry}>{t('drawGeometryTest')}</button>
      <span className="toolbar-sep" />
      <div className="mode-switch" role="group" aria-label={t('editMode')}>
        <button type="button" className={mode === 'wysiwyg' ? 'active' : ''} onClick={() => onModeChange('wysiwyg')}>{t('edit')}</button>
        <button type="button" className={mode === 'source' ? 'active' : ''} onClick={() => onModeChange('source')}>{t('source')}</button>
      </div>
    </div>
    <div className="toolbar-right">
      <div className="doc-title" title={docTitle}>{dirty ? '• ' : ''}{docTitle}</div>
      <button type="button" className="toolbar-settings-button" aria-label={t('settings')} title={t('settings')} onClick={onSettings}><SettingsIcon /></button>
    </div>
  </header>
}

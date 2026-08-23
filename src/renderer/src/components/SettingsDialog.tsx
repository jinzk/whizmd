import { useState } from 'react'
import type { AppConfig, LanguageMode, ThemeMode } from '@shared/types'
import { useI18n } from '../i18n'
import { Dialog } from './Dialog'

interface Props {
  config: AppConfig
  originalConfig: AppConfig
  onChange: (config: AppConfig) => void
  onApply: (config: AppConfig) => Promise<void>
  onClose: () => void
}

export function SettingsDialog({ config, originalConfig, onChange, onApply, onClose }: Props): React.JSX.Element {
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'editor' | 'files'>('general')
  const changed = JSON.stringify(config) !== JSON.stringify(originalConfig)
  const assetsValid = config.assetsDir.trim().length > 0 && !config.assetsDir.split(/[\\/]/).includes('..') && !/^[A-Za-z]:|^\\\\/.test(config.assetsDir)
  const apply = async (): Promise<void> => {
    if (!assetsValid) { setError(t('invalidAssetsDirectory')); return }
    setSaving(true)
    setError(null)
    try { await onApply(config) } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } finally { setSaving(false) }
  }
  const requestClose = (): void => { if (changed) setConfirmDiscard(true); else onClose() }
  return (
    <Dialog title={t('settings')} titleId="settings-title" className="settings-dialog" onBackdropClick={requestClose}>
        <div className="settings-tabs" role="tablist" aria-label={t('settingsCategories')}>
          {([['general', t('generalSettings')], ['editor', t('editorSettings')], ['files', t('fileSettings')]] as const).map(([value, label], index, tabs) => (
            <button key={value} id={`settings-tab-${value}`} type="button" role="tab" aria-selected={activeTab === value} aria-controls={`settings-panel-${value}`} tabIndex={activeTab === value ? 0 : -1} className={activeTab === value ? 'active' : ''} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; setActiveTab(tabs[next][0]); document.getElementById(`settings-tab-${tabs[next][0]}`)?.focus() } }} onClick={() => setActiveTab(value)}>{label}</button>
          ))}
        </div>
        <div id={`settings-panel-${activeTab}`} aria-labelledby={`settings-tab-${activeTab}`} className="settings-form" role="tabpanel" tabIndex={0}>
          {activeTab === 'general' ? <>
          <label>
            <span>{t('theme')}</span>
            <select value={config.themeMode} onChange={(event) => onChange({ ...config, themeMode: event.target.value as ThemeMode })}>
              <option value="system">{t('systemTheme')}</option>
              <option value="light">{t('lightTheme')}</option>
              <option value="dark">{t('darkTheme')}</option>
            </select>
          </label>
          <label className="settings-checkbox">
            <span>{t('autoSave')}</span>
            <input type="checkbox" checked={config.autoSave} onChange={(event) => onChange({ ...config, autoSave: event.target.checked })} />
          </label>
          <label>
            <span>{t('language')}</span>
            <select value={config.language} onChange={(event) => onChange({ ...config, language: event.target.value as LanguageMode })}>
              <option value="system">{t('system')}</option><option value="zh-CN">{t('chinese')}</option><option value="en-US">{t('english')}</option>
            </select>
          </label>
          </> : null}
          {activeTab === 'editor' ? <>
          <label>
            <span>{t('autoSaveDelay')}</span>
            <select value={config.autoSaveDelay} onChange={(event) => onChange({ ...config, autoSaveDelay: Number(event.target.value) as AppConfig['autoSaveDelay'] })}>
              <option value="500">500 ms</option><option value="1000">1 s</option><option value="3000">3 s</option>
            </select>
          </label>
          <label>
            <span>{t('editorFontSize')}</span>
            <select value={config.editorFontSize} onChange={(event) => onChange({ ...config, editorFontSize: Number(event.target.value) as AppConfig['editorFontSize'] })}>
              <option value="14">14 px</option><option value="16">16 px</option><option value="18">18 px</option>
            </select>
          </label>
          <label>
            <span>{t('editorContentWidth')}</span>
            <select value={config.editorContentWidth} onChange={(event) => onChange({ ...config, editorContentWidth: Number(event.target.value) as AppConfig['editorContentWidth'] })}>
              <option value="680">680 px</option><option value="800">800 px</option><option value="960">960 px</option>
            </select>
          </label>
          <label className="settings-checkbox">
            <span>{t('spellCheck')}</span>
            <input type="checkbox" checked={config.spellCheck} onChange={(event) => onChange({ ...config, spellCheck: event.target.checked })} />
          </label>
          </> : null}
          {activeTab === 'files' ? <>
           <label>
             <span>{t('assetsDirectory')}</span>
             <input value="assets" readOnly aria-readonly="true" />
             <small>{t('assetsDirectoryHint')}</small>
           </label>
           <label className="settings-checkbox">
             <span>{t('toggleMarkdownOnly')}</span>
             <input type="checkbox" checked={config.showMarkdownOnly} onChange={(event) => onChange({ ...config, showMarkdownOnly: event.target.checked })} />
           </label>
          </> : null}
        </div>
        <div className="app-dialog-actions">
          <button type="button" onClick={requestClose}>{t('cancel')}</button>
          <button type="button" className="app-dialog-primary" disabled={saving} onClick={() => void apply()}>{saving ? t('saving') : t('apply')}</button>
        </div>
        {error ? <p className="settings-error" role="alert">{error}</p> : null}
        {confirmDiscard ? <div className="settings-discard-confirm" role="alertdialog"><p>{t('discardSettingsMessage')}</p><button type="button" onClick={() => setConfirmDiscard(false)}>{t('continueEditing')}</button><button type="button" className="app-dialog-danger" onClick={onClose}>{t('discardChanges')}</button></div> : null}
    </Dialog>
  )
}

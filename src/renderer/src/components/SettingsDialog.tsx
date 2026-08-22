import type { AppConfig, LanguageMode, ThemeMode } from '@shared/types'
import { useI18n } from '../i18n'
import { Dialog } from './Dialog'

interface Props {
  config: AppConfig
  onChange: (config: AppConfig) => void
  onApply: (config: AppConfig) => Promise<void>
  onClose: () => void
}

export function SettingsDialog({ config, onChange, onApply, onClose }: Props): React.JSX.Element {
  const { t } = useI18n()
  return (
    <Dialog title={t('settings')} titleId="settings-title" className="settings-dialog" onBackdropClick={onClose}>
        <div className="settings-form">
          <label>
            <span>{t('theme')}</span>
            <select value={config.themeMode} onChange={(event) => onChange({ ...config, themeMode: event.target.value as ThemeMode })}>
              <option value="system">{t('systemTheme')}</option>
              <option value="light">{t('lightTheme')}</option>
              <option value="dark">{t('darkTheme')}</option>
            </select>
          </label>
          <label>
            <span>{t('language')}</span>
            <select value={config.language} onChange={(event) => onChange({ ...config, language: event.target.value as LanguageMode })}>
              <option value="system">{t('system')}</option>
              <option value="zh-CN">{t('chinese')}</option>
              <option value="en-US">{t('english')}</option>
            </select>
          </label>
          <label>
            <span>{t('assetsDirectory')}</span>
            <input value={config.assetsDir} onChange={(event) => onChange({ ...config, assetsDir: event.target.value })} placeholder="assets" />
            <small>{t('assetsDirectoryHint')}</small>
          </label>
          <label>
            <span>{t('imagePathStrategy')}</span>
            <select value={config.imagePathStrategy} onChange={(event) => onChange({ ...config, imagePathStrategy: event.target.value as AppConfig['imagePathStrategy'] })}>
              <option value="relative">{t('relativePath')}</option>
              <option value="absolute">{t('absolutePath')}</option>
            </select>
          </label>
        </div>
        <div className="app-dialog-actions">
          <button type="button" onClick={onClose}>{t('cancel')}</button>
          <button type="button" className="app-dialog-primary" onClick={() => void onApply(config)}>{t('apply')}</button>
        </div>
    </Dialog>
  )
}

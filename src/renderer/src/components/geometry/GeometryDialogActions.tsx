type Props = {
  editing: boolean
  onCancel: (event: React.MouseEvent<HTMLButtonElement>) => void
  onSave: () => void
}

export function GeometryDialogActions({ editing, onCancel, onSave }: Props): React.JSX.Element {
  const { t } = useI18n()
  return (
    <div className="geometry-dialog-actions">
      <button type="button" onClick={onCancel}>{t('cancel')}</button>
      <button type="button" onClick={onSave}>{editing ? t('save') : '插入'}</button>
    </div>
  )
}
import { useI18n } from '../../i18n'

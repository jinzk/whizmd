import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'

type Field = { value: string; change: (value: string) => void; commit?: () => void; onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void }
type Props = { alt: Field; src: Field; title: Field; href?: Field; onDelete: () => void; srcExtra?: ReactNode; extra?: ReactNode }

export function MediaFields({ alt, src, title, href, onDelete, srcExtra, extra }: Props): React.JSX.Element {
  const { t } = useI18n()
  const input = (field: Field, label: string, placeholder: string): React.JSX.Element => <input value={field.value} aria-label={label} placeholder={placeholder} onChange={(event) => field.change(event.target.value)} onBlur={field.commit} onKeyDown={field.onKeyDown} />
  return <span className={`image-fields ${href ? 'image-link-fields' : ''}`}>
    <span className="image-field"><span>{t('imageAlt')}</span>{input(alt, t('imageAlt'), t('enterImageAlt'))}<button type="button" className="block-module-delete image-delete" aria-label={t('deleteImage')} title={t('deleteImage')} onMouseDown={(event) => event.preventDefault()} onClick={onDelete}>{t('delete')}</button></span>
    <label className="image-field"><span>{t('imageSrc')}</span>{input(src, t('imageSrc'), t('enterImageAddress'))}{srcExtra ? <span className="image-field-action">{srcExtra}</span> : null}</label>
    <label className="image-field"><span>{t('imageTitle')}</span>{input(title, t('imageTitle'), t('enterImageTitle'))}</label>
    {href ? <label className="image-field"><span>{t('linkAddress')}</span>{input(href, t('linkAddress'), 'https://example.com')}</label> : null}
    {extra}
  </span>
}

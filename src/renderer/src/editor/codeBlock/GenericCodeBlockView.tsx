import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useI18n } from '../../i18n'

export function GenericCodeBlockView({ node, deleteNode }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const language = String(node.attrs.language ?? '').trim() || 'plaintext'
  const copyCode = (): void => { void navigator.clipboard?.writeText(node.textContent) }

  return <NodeViewWrapper className="code-block-lowlight">
    <div className="block-source-header code-block-header">
      <span className="code-block-language">{language}</span>
      <button type="button" className="code-block-copy" aria-label={t('copyCode')} title={t('copyCode')} onMouseDown={(event) => event.preventDefault()} onClick={copyCode}>{t('copyCode')}</button>
      <button type="button" className="block-module-delete" aria-label={t('deleteCodeBlock')} title={t('deleteCodeBlock')} onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>{t('deleteCodeBlock')}</button>
    </div>
    <pre><code><NodeViewContent /></code></pre>
  </NodeViewWrapper>
}

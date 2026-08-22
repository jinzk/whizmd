import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useI18n } from '../i18n'

const ALERT_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']

export function MarkdownAlertNodeView({ node, updateAttributes }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  return (
    <NodeViewWrapper as="aside" className="markdown-alert-node" data-alert-kind={node.attrs.kind}>
      <div className="markdown-alert-header">
        <select
          value={node.attrs.kind}
          aria-label={t('alertType')}
          onChange={(event) => updateAttributes({ kind: event.target.value })}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {ALERT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>
      <NodeViewContent className="markdown-alert-content" />
    </NodeViewWrapper>
  )
}

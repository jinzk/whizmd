import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

const ALERT_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']

export function MarkdownAlertNodeView({ node, updateAttributes }: NodeViewProps): React.JSX.Element {
  return (
    <NodeViewWrapper as="aside" className="markdown-alert-node" data-alert-kind={node.attrs.kind}>
      <div className="markdown-alert-header">
        <select
          value={node.attrs.kind}
          aria-label="提示块类型"
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

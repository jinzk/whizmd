import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useI18n } from '../i18n'

function findFirstReference(editor: NodeViewProps['editor'], id: string): number | null {
  let result: number | null = null
  editor.state.doc.descendants((node, position) => {
    if (result === null && node.type.name === 'footnoteReference' && String(node.attrs.id) === id) result = position
  })
  return result
}

export function FootnoteDefinitionNodeView({ node, editor, deleteNode }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const jumpToReference = (): void => {
    const position = findFirstReference(editor, String(node.attrs.id))
    if (position !== null) editor.commands.setNodeSelection(position)
    editor.commands.scrollIntoView()
  }

  return (
    <NodeViewWrapper as="aside" className="footnote-definition-node">
      <header className="footnote-definition-header">
        <strong>{t('footnote')} {node.attrs.id}</strong>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={jumpToReference}>{t('footnoteBack')}</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>{t('delete')}</button>
      </header>
      <NodeViewContent className="footnote-definition-content" />
    </NodeViewWrapper>
  )
}

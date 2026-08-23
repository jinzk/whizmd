import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'

export function GenericCodeBlockView({ node, selected, editor, getPos, deleteNode }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const [editing, setEditing] = useState(selected)
  const language = String(node.attrs.language ?? '').trim() || 'plaintext'
  const copyCode = (): void => { void navigator.clipboard?.writeText(node.textContent) }

  useEffect(() => {
    const updateEditing = (): void => {
      const position = getPos()
      if (position === undefined) return
      const selection = editor.state.selection
      setEditing(selected || (selection.from > position && selection.from < position + node.nodeSize))
    }
    updateEditing()
    editor.on('selectionUpdate', updateEditing)
    return () => { editor.off('selectionUpdate', updateEditing) }
  }, [editor, getPos, node.nodeSize, selected])

  return <NodeViewWrapper className="code-block-lowlight">
    <div className="block-source-header code-block-header">
      <span className="code-block-language">{language}</span>
      <button type="button" className="code-block-copy" aria-label={t('copyCode')} title={t('copyCode')} onMouseDown={(event) => event.preventDefault()} onClick={copyCode}>{t('copyCode')}</button>
       {editing ? <button type="button" className="block-module-delete" aria-label={t('deleteCodeBlock')} title={t('deleteCodeBlock')} onMouseDown={(event) => event.preventDefault()} onClick={deleteNode}>{t('deleteCodeBlock')}</button> : null}
    </div>
    <pre><code><NodeViewContent /></code></pre>
  </NodeViewWrapper>
}

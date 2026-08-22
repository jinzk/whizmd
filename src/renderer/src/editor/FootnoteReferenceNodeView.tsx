import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { useI18n } from '../i18n'

function findDefinition(editor: NodeViewProps['editor'], id: string): number | null {
  let result: number | null = null
  editor.state.doc.descendants((node, position) => {
    if (result === null && node.type.name === 'footnoteDefinition' && String(node.attrs.id) === id) result = position
  })
  return result
}

export function FootnoteReferenceNodeView({ node, editor }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const activate = (): void => {
    const id = String(node.attrs.id)
    const position = findDefinition(editor, id)
    if (position !== null) {
      editor.commands.setNodeSelection(position)
      editor.commands.scrollIntoView()
      return
    }

    const definitionType = editor.schema.nodes.footnoteDefinition
    const paragraph = editor.schema.nodes.paragraph.create()
    const definition = definitionType.create({ id }, paragraph)
    const insertAt = editor.state.doc.content.size
    const transaction = editor.state.tr.insert(insertAt, definition)
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(insertAt + 2)))
    editor.view.dispatch(transaction)
    editor.commands.scrollIntoView()
  }

  return (
    <NodeViewWrapper as="sup" className="footnote-reference-node">
       <button type="button" aria-label={`${t('footnote')} ${node.attrs.id}`} onMouseDown={(event) => event.preventDefault()} onClick={activate}>
        [{node.attrs.id}]
      </button>
    </NodeViewWrapper>
  )
}

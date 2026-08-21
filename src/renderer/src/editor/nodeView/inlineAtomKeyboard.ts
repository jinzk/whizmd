import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { NodeType } from '@tiptap/pm/model'

type Direction = 'left' | 'right'
type DeleteDirection = 'backward' | 'forward'

export function inlineAtomKeyboardShortcuts(type: NodeType) {
  const moveAcross = (direction: Direction) => ({ editor }: { editor: Editor }): boolean => {
    const { selection } = editor.state
    if (selection instanceof NodeSelection && selection.node.type === type) {
      editor.commands.setTextSelection(direction === 'left' ? selection.from : selection.to)
      return true
    }
    if (!selection.empty || !(selection instanceof TextSelection)) return false
    const position = direction === 'left' ? selection.from - 1 : selection.from
    const node = editor.state.doc.nodeAt(position)
    if (!node || node.type !== type) return false
    editor.commands.setTextSelection(direction === 'left' ? position - node.nodeSize + 1 : position + node.nodeSize)
    return true
  }

  const remove = (direction: DeleteDirection) => ({ editor }: { editor: Editor }): boolean => {
    const { selection } = editor.state
    if (selection instanceof NodeSelection && selection.node.type === type) {
      editor.commands.deleteSelection()
      return true
    }
    if (!selection.empty) return false
    const position = direction === 'backward' ? selection.from - 1 : selection.from
    const node = editor.state.doc.nodeAt(position)
    if (!node || node.type !== type) return false
    const from = direction === 'backward' ? position - node.nodeSize + 1 : position
    editor.view.dispatch(editor.state.tr.delete(from, from + node.nodeSize))
    return true
  }

  return {
    ArrowLeft: moveAcross('left'),
    ArrowRight: moveAcross('right'),
    Backspace: remove('backward'),
    Delete: remove('forward')
  }
}

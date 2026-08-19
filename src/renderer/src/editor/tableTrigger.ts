import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { PluginKey } from '@tiptap/pm/state'
import { addColumnAfter, addRowAfter, cellAround, deleteColumn, deleteRow, selectedRect } from 'prosemirror-tables'

const tableUiKey = new PluginKey('tableUi')

export const TableTrigger = Extension.create({
  name: 'tableTrigger',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: tableUiKey,
        view: (editorView) => {
          const addButton = document.createElement('button')
          addButton.type = 'button'
          addButton.className = 'table-add-button table-add-column'
          addButton.textContent = '+'
          addButton.title = '增加列'
          const addRowButton = document.createElement('button')
          addRowButton.type = 'button'
          addRowButton.className = 'table-add-button table-add-row'
          addRowButton.textContent = '+'
          addRowButton.title = '增加行'
          const removeButton = document.createElement('button')
          removeButton.type = 'button'
          removeButton.className = 'table-add-button table-remove-column'
          removeButton.textContent = '-'
          removeButton.title = '删除列'
          const removeRowButton = document.createElement('button')
          removeRowButton.type = 'button'
          removeRowButton.className = 'table-add-button table-remove-row'
          removeRowButton.textContent = '-'
          removeRowButton.title = '删除行'
          const alignToolbar = document.createElement('div')
          alignToolbar.className = 'table-align-toolbar'
          for (const [label, value] of [['左对齐', 'left'], ['居中', 'center'], ['右对齐', 'right']]) {
            const button = document.createElement('button')
            button.type = 'button'
            button.textContent = label
            button.addEventListener('mousedown', (event) => event.preventDefault())
            button.addEventListener('click', () => {
              const { state } = editorView
              const rect = selectedRect(state)
              const { map, tableStart, left } = rect
              let transaction = state.tr
              for (let row = 0; row < map.height; row += 1) {
                const pos = map.map[row * map.width + left]
                const cellNode = rect.table.nodeAt(pos)
                if (cellNode) {
                  transaction = transaction.setNodeMarkup(tableStart + pos, cellNode.type, {
                    ...cellNode.attrs,
                    align: value
                  })
                }
              }
              editorView.dispatch(transaction)
              editorView.focus()
            })
            alignToolbar.append(button)
          }
          document.body.append(addButton, addRowButton, removeButton, removeRowButton, alignToolbar)
          const reposition = (): void => {
            const table = editorView.dom.querySelector('table')
            const { $from } = editorView.state.selection
            let isSelectionInTable = false
            for (let depth = $from.depth; depth > 0; depth -= 1) {
              if ($from.node(depth).type.name === 'table') {
                isSelectionInTable = true
                break
              }
            }
            const isEditingTable = Boolean(table && editorView.hasFocus() && isSelectionInTable)
            if (!table || !isEditingTable) {
              addButton.style.display = 'none'
              addRowButton.style.display = 'none'
              removeButton.style.display = 'none'
              removeRowButton.style.display = 'none'
              alignToolbar.style.display = 'none'
              return
            }
            const rect = table.getBoundingClientRect()
            // Keep the floating controls outside the editor's hit-test area.
            addButton.style.pointerEvents = 'auto'
            addRowButton.style.pointerEvents = 'auto'
            removeButton.style.pointerEvents = 'auto'
            removeRowButton.style.pointerEvents = 'auto'
            alignToolbar.style.pointerEvents = 'auto'
            addButton.style.display = 'flex'
            addRowButton.style.display = 'flex'
            addButton.style.left = `${rect.right + 6}px`
            addButton.style.top = `${rect.top + rect.height / 2 - 12}px`
            removeButton.style.display = 'flex'
            removeButton.style.left = `${rect.right + 6}px`
            removeButton.style.top = `${rect.top + rect.height / 2 + 16}px`
            addRowButton.style.left = `${rect.left + rect.width / 2 - 12}px`
            addRowButton.style.top = `${rect.bottom + 6}px`
            removeRowButton.style.display = 'flex'
            removeRowButton.style.left = `${rect.left + rect.width / 2 + 16}px`
            removeRowButton.style.top = `${rect.bottom + 6}px`
            const cell = $from.node(-1)
            alignToolbar.style.display = cell?.type.name === 'tableHeader' ? 'flex' : 'none'
            if (cell?.type.name === 'tableHeader') {
              const cellDom = editorView.nodeDOM($from.before(-1)) as HTMLElement | null
              const cellRect = cellDom?.getBoundingClientRect()
              if (cellRect) {
                alignToolbar.style.left = `${cellRect.left}px`
                alignToolbar.style.top = `${cellRect.top - 38}px`
              }
            }
          }
          const runTableCommand = (action: (state: typeof editorView.state, dispatch: typeof editorView.dispatch) => boolean): void => {
            action(editorView.state, editorView.dispatch)
            editorView.focus()
          }
          addButton.addEventListener('mousedown', (event) => event.preventDefault())
          addButton.addEventListener('click', () => runTableCommand(addColumnAfter))
          removeButton.addEventListener('mousedown', (event) => event.preventDefault())
          removeButton.addEventListener('click', () => runTableCommand(deleteColumn))
          addRowButton.addEventListener('mousedown', (event) => event.preventDefault())
          addRowButton.addEventListener('click', () => {
            runTableCommand(addRowAfter)
          })
          removeRowButton.addEventListener('mousedown', (event) => event.preventDefault())
          removeRowButton.addEventListener('click', () => runTableCommand(deleteRow))
          window.addEventListener('scroll', reposition, true)
          window.addEventListener('resize', reposition)
          return {
            update: () => reposition(),
            destroy: () => {
              addButton.remove()
              addRowButton.remove()
              removeButton.remove()
              removeRowButton.remove()
              alignToolbar.remove()
              window.removeEventListener('scroll', reposition, true)
              window.removeEventListener('resize', reposition)
            }
          }
        },
        appendTransaction: (transactions, _oldState, newState) => {
          if (transactions.every((tr) => !tr.docChanged)) return null
          const emptyCellPositions: number[] = []
          newState.doc.descendants((node, pos) => {
            if ((node.type.name === 'tableCell' || node.type.name === 'tableHeader') && node.childCount === 0) {
              emptyCellPositions.push(pos)
            }
          })
          if (emptyCellPositions.length === 0) return null
          const tr = newState.tr
          for (let i = emptyCellPositions.length - 1; i >= 0; i -= 1) {
            tr.insert(emptyCellPositions[i] + 1, newState.schema.nodes.paragraph.create())
          }
          return tr
        },
        props: {
          handleClick: (view, pos, event) => {
            if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey) {
              return false
            }
            const $cell = cellAround(view.state.doc.resolve(pos))
            if (!$cell) return false
            const cell = $cell.nodeAfter
            if (!cell) return false

            let tr = view.state.tr
            if (cell.childCount === 0) {
              const contentPos = $cell.pos + 1
              tr = tr.insert(contentPos, view.state.schema.nodes.paragraph.create())
              tr = tr.setSelection(TextSelection.create(tr.doc, contentPos + 1))
            } else {
              tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos)))
            }
            view.dispatch(tr)
            view.focus()
            return true
          },
          handleTextInput: (view, from, to, text) => {
            const { state } = view
            const { $from } = state.selection
            if (
              text !== '|' ||
              from !== to ||
              !$from.parent.isTextblock ||
              $from.parentOffset !== 0 ||
              $from.parent.type.name !== 'paragraph'
            ) {
              return false
            }

            const { schema } = state
            const paragraph = schema.nodes.paragraph.create()
            const cell = schema.nodes.tableCell.create(null, paragraph)
            const header = schema.nodes.tableHeader.create(null, paragraph.copy())
            const headerRow = schema.nodes.tableRow.create(null, [header, header.copy()])
            const bodyRow = schema.nodes.tableRow.create(null, [cell.copy(), cell.copy()])
            const table = schema.nodes.table.create(null, [headerRow, bodyRow])
            const transaction = state.tr.replaceWith($from.before(), $from.after(), table)
            const firstCellTextPosition = $from.before() + 4
            transaction.setSelection(TextSelection.create(transaction.doc, firstCellTextPosition))
            view.dispatch(transaction)
            return true
          }
        }
      })
    ]
  }
})

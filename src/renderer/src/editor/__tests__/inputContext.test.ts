import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildEditorExtensions } from '../extensions'
import { canTriggerInlineMarkdown, getInputContext } from '../input/context'
import { triggersForEnding } from '../input/triggers'

function createEditor(content = ''): Editor {
  return new Editor({ extensions: buildEditorExtensions(), content, contentType: 'markdown' })
}

describe('input context and trigger registry', () => {
  it('allows inline syntax in table cells but blocks code and HTML blocks', () => {
    const tableEditor = createEditor('| Value |\n| --- |\n| text |')
    let cellPosition = 0
    tableEditor.state.doc.descendants((node, position) => {
      if (!cellPosition && node.type.name === 'paragraph' && node.textContent === 'text') cellPosition = position + 1
    })
    const tableContext = getInputContext(tableEditor.state, cellPosition)
    expect(tableContext.inTableCell).toBe(true)
    expect(canTriggerInlineMarkdown(tableEditor.state, cellPosition)).toBe(true)
    tableEditor.destroy()

    const codeEditor = createEditor('```\ncode\n```')
    const codePosition = codeEditor.state.doc.firstChild?.content.size ?? 0
    expect(getInputContext(codeEditor.state, codePosition).inCodeBlock).toBe(true)
    expect(canTriggerInlineMarkdown(codeEditor.state, codePosition)).toBe(false)
    codeEditor.destroy()

    const htmlEditor = createEditor('<div>raw HTML</div>')
    const htmlPosition = htmlEditor.state.doc.firstChild ? 1 : 0
    expect(getInputContext(htmlEditor.state, htmlPosition).inHtmlBlock).toBe(true)
    expect(canTriggerInlineMarkdown(htmlEditor.state, htmlPosition)).toBe(false)
    htmlEditor.destroy()
  })

  it('orders competing inline triggers by priority', () => {
    expect(triggersForEnding(']')[0]?.name).toBe('linkNode')
    expect(triggersForEnding('$')[0]?.name).toBe('inlineMath')
    expect(triggersForEnding('^')[0]?.name).toBe('inlineDecoration')
  })
})

import { Table, renderTableToMarkdown } from '@tiptap/extension-table'

function escapeCellPipes(value: string): string {
  return value.replace(/(?<!\\)\|/g, '\\|')
}

/** Keep standard Markdown tables valid when inline content contains a pipe. */
export const MarkdownTable = Table.extend({
  renderMarkdown(node, helpers) {
    return renderTableToMarkdown(node, {
      ...helpers,
      renderChildren: (content) => escapeCellPipes(helpers.renderChildren(content))
    })
  }
})

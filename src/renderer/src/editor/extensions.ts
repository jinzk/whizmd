import type { AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { buildMarkdownExtension } from './markdown'
import { MermaidCodeBlock } from './mermaid'
import { lowlight } from './lowlight'
import { InlineMath, BlockMath } from './math'
import { Image } from './image'
import { ActiveLine } from './activeLine'
import { LinkNode } from './link'
import { TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { MarkdownTable } from './table'
import { TableTrigger } from './tableTrigger'
import { InlineHtml } from './inlineHtml'
import { HtmlBlock } from './htmlBlock'
import { SyntaxSource } from './syntaxSource'
import { MarkdownPaste } from './markdownPaste'
import { createPairedTriggerExtension } from './input/pairedTrigger'
import { InlineSyntax } from './inlineSyntax'
import { TaskItem } from '@tiptap/extension-list/task-item'
import { TaskList } from '@tiptap/extension-list/task-list'
import { FootnoteReference, FootnoteDefinition, MarkdownAlert, InlineDecoration, DefinitionListItem, ReferenceDefinition } from './syntax'

/**
 * Full set of extensions for WYSIWYG mode. StarterKit provides the base nodes
 * and marks (minus code blocks, which are replaced by a mermaid/lowlight-aware
 * version). The Markdown bridge handles two-way conversion.
 */
export function buildEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({ codeBlock: false, link: { markdownLinks: true } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    MermaidCodeBlock.configure({ lowlight, defaultLanguage: 'plaintext' }),
    InlineMath.configure({ katexOptions: { throwOnError: false, displayMode: false } }),
    BlockMath.configure({ katexOptions: { throwOnError: false, displayMode: true } }),
    Image.configure({ allowBase64: true }),
    LinkNode,
    InlineHtml,
    HtmlBlock,
    InlineSyntax,
    FootnoteReference,
    FootnoteDefinition,
    MarkdownAlert,
    InlineDecoration,
    DefinitionListItem,
    ReferenceDefinition,
    SyntaxSource,
    MarkdownPaste,
    createPairedTriggerExtension([
      {
        marker: '`',
        priority: 50,
        accepts: (content) => content.length > 0 && !content.includes('\n') && !content.includes('`'),
        createNode: (content, state) => {
          const mark = state?.schema.marks.code?.create()
          return mark && state ? state.schema.text(content, [mark]) : null
        }
      }
    ], 'inlineCodeCompletion'),
    MarkdownTable.configure({ HTMLAttributes: { class: 'wysiwyg-table' } }),
    TableRow,
    TableHeader,
    TableCell,
    TableTrigger,
    ActiveLine,
    buildMarkdownExtension()
  ]
}

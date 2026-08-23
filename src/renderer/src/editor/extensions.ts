import type { AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { buildMarkdownExtension } from './markdown'
import { CodeBlockExtension } from './codeBlock'
import { lowlight } from './lowlight'
import { InlineMath, BlockMath } from './math'
import { Image } from './image'
import { ActiveLine } from './activeLine'
import { LinkNode } from './link'
import { TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { MarkdownTable } from './table'
import { TableTrigger } from './tableTrigger'
import { InlineHtml } from './inlineHtml'
import { ImageLinkNode } from './imageLink'
import { HtmlBlock } from './htmlBlock'
import { SyntaxSource } from './syntaxSource'
import { MarkdownPaste } from './markdownPaste'
import { InlineSegments } from './inline/inlineSegments'
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
    CodeBlockExtension.configure({ lowlight, defaultLanguage: 'plaintext' }),
    InlineMath.configure({ katexOptions: { throwOnError: false, displayMode: false } }),
    BlockMath.configure({ katexOptions: { throwOnError: false, displayMode: true } }),
    Image.configure({ allowBase64: true, inline: true }),
    ImageLinkNode,
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
    InlineSegments,
    MarkdownTable.configure({ HTMLAttributes: { class: 'wysiwyg-table' } }),
    TableRow,
    TableHeader,
    TableCell,
    TableTrigger,
    ActiveLine,
    buildMarkdownExtension()
  ]
}

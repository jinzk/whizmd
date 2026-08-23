import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Fragment } from '@tiptap/pm/model'
import { parseInlineSegments } from './parseInlineSegments'
import { segmentsToNodes } from './segmentsToNodes'
import { isInCodeBlock, isInHtmlBlock } from '../input/context'

export const InlineSegments = Extension.create({
  name: 'inlineSegments',
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction: (transactions, oldState, state) => {
        if (!transactions.some((transaction) => transaction.docChanged)) return null
        // Attribute-only updates from NodeViews (for example editing an image
        // link URL) already preserve the correct atom. Re-parsing the whole
        // textblock here can turn that atom into a generic link.
        if (oldState.doc.textContent === state.doc.textContent) return null
        const { from, empty } = state.selection
        if (!empty) return null
        if (isInCodeBlock(state, from) || isInHtmlBlock(state, from)) return null
        const resolved = state.doc.resolve(from)
        if (!resolved.parent.isTextblock) return null
        const source = resolved.parent.content.content.map((node) => {
          if (node.isText) return node.text ?? ''
          if (node.type.name === 'inlineMath') return `$${String(node.attrs.latex ?? '')}$`
          if (node.type.name === 'inlineHtml') return String(node.attrs.html ?? '')
          if (node.type.name === 'linkNode') {
            return node.attrs.reference
              ? `[${String(node.attrs.text ?? '')}][${String(node.attrs.reference)}]`
              : `[${String(node.attrs.text ?? '')}](${String(node.attrs.href ?? '')})`
          }
          if (node.type.name === 'image') {
            const title = node.attrs.title ? ` "${String(node.attrs.title)}"` : ''
            const width = node.attrs.width ? ` =${String(node.attrs.width)}` : ''
            return `![${String(node.attrs.alt ?? '')}](${String(node.attrs.src ?? '')}${title}${width})`
          }
          if (node.type.name === 'imageLinkNode') {
            const title = node.attrs.title ? ` "${String(node.attrs.title)}"` : ''
            return `[![${String(node.attrs.alt ?? '')}](${String(node.attrs.src ?? '')}${title})](${String(node.attrs.href ?? '')})`
          }
          if (node.type.name === 'inlineSyntax') {
            const marker = node.attrs.kind === 'boldItalic' ? '***' : node.attrs.kind === 'bold' ? '**' : node.attrs.kind === 'strike' ? '~~' : '*'
            return `${marker}${String(node.attrs.value ?? '')}${marker}`
          }
          if (node.type.name === 'inlineDecoration') {
            const marker = node.attrs.kind === 'highlight' ? '==' : node.attrs.kind === 'superscript' ? '^' : '~'
            return `${marker}${String(node.attrs.value ?? '')}${marker}`
          }
          return node.textContent
        }).join('')
        const segments = parseInlineSegments(source)
        if (segments.length <= 1 && segments[0]?.type === 'text') return null
        const nodes = segmentsToNodes(state, segments)
        if (Fragment.from(nodes).eq(resolved.parent.content)) return null
        const transaction = state.tr.replaceWith(resolved.start(), resolved.end(), nodes)
        return transaction.docChanged ? transaction : null
      }
    })]
  }
})

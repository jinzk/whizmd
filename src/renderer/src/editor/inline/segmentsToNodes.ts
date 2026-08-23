import type { EditorState } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { InlineSegment } from './parseInlineSegments'

export function segmentsToNodes(state: EditorState, segments: readonly InlineSegment[]): ProseMirrorNode[] {
  return segments.flatMap((segment) => {
    if (segment.type === 'text') return segment.value ? [state.schema.text(segment.value)] : []
    if (segment.type === 'inlineMath') return [state.schema.nodes.inlineMath.create({ latex: segment.value })]
    if (segment.type === 'inlineHtml') return [state.schema.nodes.inlineHtml.create({ html: segment.value })]
    if (segment.type === 'linkNode') return [state.schema.nodes.linkNode.create({ text: segment.text, href: segment.href, reference: segment.reference })]
    if (segment.type === 'image') return [state.schema.nodes.image.create({ src: segment.src, alt: segment.alt, title: segment.title, width: segment.width, reference: segment.reference })]
    if (segment.type === 'imageLinkNode') return [state.schema.nodes.imageLinkNode.create(segment)]
    if (segment.type === 'inlineSyntax') return [state.schema.nodes.inlineSyntax.create({ kind: segment.kind, value: segment.value })]
    return [state.schema.nodes.inlineDecoration.create({ kind: segment.kind, value: segment.value })]
  })
}

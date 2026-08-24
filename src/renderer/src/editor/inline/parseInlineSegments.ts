export type InlineSegment =
  | { type: 'text'; value: string }
  | { type: 'inlineMath'; value: string }
  | { type: 'inlineHtml'; value: string }
  | { type: 'linkNode'; text: string; href: string; reference: string | null }
  | { type: 'image'; src: string; alt: string; title: string | null; width: number | null; reference: string | null }
  | { type: 'imageLinkNode'; src: string; alt: string; title: string | null; href: string; reference: string | null }
  | { type: 'inlineSyntax'; kind: 'italic' | 'bold' | 'boldItalic' | 'strike'; value: string }
  | { type: 'inlineDecoration'; kind: 'highlight' | 'superscript' | 'subscript'; value: string }

type Candidate = { start: number; end: number; segment: InlineSegment }
type CandidateMatch = { end: number; priority: number; segment: InlineSegment }
import { isEscaped } from './escape'

const definitions = [
  ['***', 'inlineSyntax', 'boldItalic'],
  ['**', 'inlineSyntax', 'bold'],
  ['*', 'inlineSyntax', 'italic'],
  ['~~', 'inlineSyntax', 'strike'],
  ['==', 'inlineDecoration', 'highlight'],
  ['^', 'inlineDecoration', 'superscript'],
  ['~', 'inlineDecoration', 'subscript']
] as const

function findCandidate(text: string, start: number): Candidate | null {
  const matches: CandidateMatch[] = []
  if (text.startsWith('![', start) && !isEscaped(text, start)) {
    const image = text.slice(start).match(/^!\[([^\]]*)\]\((?:"((?:[^"\\]|\\.)*)"|([^\s)]+))(?:\s+("(?:[^"\\]|\\.)*"))?(?:\s+=\s*(\d+(?:\.\d+)?)(?:x\d+(?:\.\d+)?)?)?\)/)
    if (image) matches.push({ end: start + image[0].length, priority: 90, segment: { type: 'image', alt: image[1], src: image[2] ?? image[3], title: image[4]?.slice(1, -1) ?? null, width: image[5] ? Number(image[5]) : null, reference: null } })
  }
  if (text[start] === '[' && !isEscaped(text, start)) {
    const imageLink = text.slice(start).match(/^\[!\[([^\]]*)\]\((?:"((?:[^"\\]|\\.)*)"|([^\s)]+))(?:\s+("(?:[^"\\]|\\.)*"))?\)\]\(([^)]+)\)/)
    if (imageLink) matches.push({ end: start + imageLink[0].length, priority: 110, segment: { type: 'imageLinkNode', alt: imageLink[1], src: imageLink[2] ?? imageLink[3], title: imageLink[4]?.slice(1, -1) ?? null, href: imageLink[5], reference: null } })
    // A valid image link owns the outer brackets; never let the generic link
    // parser claim the same opening sequence.
    const inline = text.slice(start).match(/^\[(?!![^[]*\]\()([^\]]*)\]\(([^)]+)\)/)
    if (inline) matches.push({ end: start + inline[0].length, priority: 80, segment: { type: 'linkNode', text: inline[1], href: inline[2], reference: null } })
    const reference = text.slice(start).match(/^\[([^\]]*)\]\[([^\]]+)\]/)
    if (reference) matches.push({ end: start + reference[0].length, priority: 80, segment: { type: 'linkNode', text: reference[1], href: reference[2], reference: reference[2] } })
  }
  const selected = matches.sort((left, right) => right.priority - left.priority || right.end - left.end)[0]
  if (selected) return { start, end: selected.end, segment: selected.segment }
  if (text[start] === '<' && !isEscaped(text, start)) {
    const match = text.slice(start).match(/^<(a|b|br|del|em|i|img|mark|s|span|strong|sub|sup|u)\b[^>]*(?:\/>|>[^\n<]*<\/\1>)/i)
    if (match) return { start, end: start + match[0].length, segment: { type: 'inlineHtml', value: match[0] } }
  }
  if (text[start] === '$' && text[start + 1] !== '$' && !isEscaped(text, start)) {
    const end = text.indexOf('$', start + 1)
    if (end > start + 1 && !isEscaped(text, end)) {
      const value = text.slice(start + 1, end)
      if (!/^\s|\s$/.test(value) && !value.includes('\n')) return { start, end: end + 1, segment: { type: 'inlineMath', value } }
    }
  }

  for (const [marker, type, kind] of definitions) {
    if (!text.startsWith(marker, start) || isEscaped(text, start)) continue
    if (marker.length === 1 && text[start - 1] === marker && !isEscaped(text, start - 1)) continue
    if (text[start + marker.length] === marker[0]) continue
    let end = text.indexOf(marker, start + marker.length)
    while (end >= 0) {
      if (end > start + marker.length && !isEscaped(text, end)) {
        const value = text.slice(start + marker.length, end)
        if (!value.includes('\n') && !value.includes(marker[0])) {
          if (type === 'inlineSyntax') return { start, end: end + marker.length, segment: { type, kind, value } }
          return { start, end: end + marker.length, segment: { type, kind, value } }
        }
      }
      end = text.indexOf(marker, end + marker.length)
    }
  }
  return null
}

export function parseInlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let plain = ''
  const flush = (): void => {
    if (plain) segments.push({ type: 'text', value: plain })
    plain = ''
  }

  for (let index = 0; index < text.length;) {
    const candidate = findCandidate(text, index)
    if (!candidate) {
      plain += text[index]
      index += 1
      continue
    }
    flush()
    segments.push(candidate.segment)
    index = candidate.end
  }
  flush()
  return segments
}

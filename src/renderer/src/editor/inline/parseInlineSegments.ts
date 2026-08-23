export type InlineSegment =
  | { type: 'text'; value: string }
  | { type: 'inlineMath'; value: string }
  | { type: 'inlineHtml'; value: string }
  | { type: 'inlineSyntax'; kind: 'italic' | 'bold' | 'boldItalic' | 'strike'; value: string }
  | { type: 'inlineDecoration'; kind: 'highlight' | 'superscript' | 'subscript'; value: string }

type Candidate = { start: number; end: number; segment: InlineSegment }

const definitions = [
  ['***', 'inlineSyntax', 'boldItalic'],
  ['**', 'inlineSyntax', 'bold'],
  ['*', 'inlineSyntax', 'italic'],
  ['~~', 'inlineSyntax', 'strike'],
  ['==', 'inlineDecoration', 'highlight'],
  ['^', 'inlineDecoration', 'superscript'],
  ['~', 'inlineDecoration', 'subscript']
] as const

function escaped(text: string, index: number): boolean {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashes += 1
  return slashes % 2 === 1
}

function findCandidate(text: string, start: number): Candidate | null {
  if (text[start] === '<' && !escaped(text, start)) {
    const match = text.slice(start).match(/^<(a|b|br|del|em|i|img|mark|s|span|strong|sub|sup|u)\b[^>]*(?:\/>|>[^\n<]*<\/\1>)/i)
    if (match) return { start, end: start + match[0].length, segment: { type: 'inlineHtml', value: match[0] } }
  }
  if (text[start] === '$' && text[start + 1] !== '$' && !escaped(text, start)) {
    const end = text.indexOf('$', start + 1)
    if (end > start + 1 && !escaped(text, end)) {
      const value = text.slice(start + 1, end)
      if (!/^\s|\s$/.test(value) && !value.includes('\n')) return { start, end: end + 1, segment: { type: 'inlineMath', value } }
    }
  }

  for (const [marker, type, kind] of definitions) {
    if (!text.startsWith(marker, start) || escaped(text, start)) continue
    if (marker.length === 1 && text[start - 1] === marker && !escaped(text, start - 1)) continue
    if (text[start + marker.length] === marker[0]) continue
    let end = text.indexOf(marker, start + marker.length)
    while (end >= 0) {
      if (end > start + marker.length && !escaped(text, end)) {
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

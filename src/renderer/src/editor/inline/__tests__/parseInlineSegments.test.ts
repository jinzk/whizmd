import { describe, expect, it } from 'vitest'
import { parseInlineSegments } from '../parseInlineSegments'

describe('parseInlineSegments', () => {
  it.each([
    ['$a$==d==', ['inlineMath', 'inlineDecoration']],
    ['$a$ <b>d</b> ==x==', ['inlineMath', 'text', 'inlineHtml', 'text', 'inlineDecoration']],
    ['==a====d==', ['inlineDecoration', 'inlineDecoration']],
    ['==d==', ['inlineDecoration']],
    ['text *italic* end', ['text', 'inlineSyntax', 'text']]
  ])('parses %s into ordered segments', (source, types) => {
    expect(parseInlineSegments(source).map((segment) => segment.type)).toEqual(types)
  })

  it('keeps unmatched and escaped markers as text', () => {
    expect(parseInlineSegments('\\==open')).toEqual([{ type: 'text', value: '\\==open' }])
  })
})

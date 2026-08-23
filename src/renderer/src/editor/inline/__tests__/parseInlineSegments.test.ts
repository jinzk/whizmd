import { describe, expect, it } from 'vitest'
import { parseInlineSegments } from '../parseInlineSegments'

describe('parseInlineSegments', () => {
  it('keeps an image link intact when following text starts with an opening bracket', () => {
    const segments = parseInlineSegments('[![图片](image.png)](https://example.com)[')
    expect(segments.map((segment) => segment.type)).toEqual(['imageLinkNode', 'text'])
  })

  it.each([
    '[![a](a.png)](https://a.test)[b](https://b.test)',
    '[![a](a.png)](https://a.test)![b](b.png)',
    '[![a](a.png)](https://a.test)[![b](b.png)](https://b.test)'
  ])('parses adjacent image-link syntax without swallowing the next node: %s', (source) => {
    expect(parseInlineSegments(source).map((segment) => segment.type)).toEqual(
      source.includes('[![b]') ? ['imageLinkNode', 'imageLinkNode'] : source.includes('![b]') ? ['imageLinkNode', 'image'] : ['imageLinkNode', 'linkNode']
    )
  })
  it.each([
    ['$a$==d==', ['inlineMath', 'inlineDecoration']],
    ['$a$ <b>d</b> ==x==', ['inlineMath', 'text', 'inlineHtml', 'text', 'inlineDecoration']],
    ['$a$ [doc](https://example.com) ==x==', ['inlineMath', 'text', 'linkNode', 'text', 'inlineDecoration']],
    ['[![图](image.png "标题")](https://example.com)', ['imageLinkNode']],
    ['==a====d==', ['inlineDecoration', 'inlineDecoration']],
    ['==d==', ['inlineDecoration']],
    ['text *italic* end', ['text', 'inlineSyntax', 'text']]
  ])('parses %s into ordered segments', (source, types) => {
    expect(parseInlineSegments(source).map((segment) => segment.type)).toEqual(types)
  })

  it('keeps unmatched and escaped markers as text', () => {
    expect(parseInlineSegments('\\==open')).toEqual([{ type: 'text', value: '\\==open' }])
  })

  it('does not translate escaped Markdown, links, or HTML markers', () => {
    expect(parseInlineSegments('\\$a\\$ \\==d\\== \\[doc\\](https://example.com) \\<b>d\\</b>')).toEqual([
      { type: 'text', value: '\\$a\\$ \\==d\\== \\[doc\\](https://example.com) \\<b>d\\</b>' }
    ])
  })
})

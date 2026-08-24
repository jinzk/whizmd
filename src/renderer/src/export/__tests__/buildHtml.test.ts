import { describe, expect, it } from 'vitest'
import { buildExportHtml } from '../buildHtml'

describe('buildExportHtml', () => {
  it('pre-renders inline and block math with katex', async () => {
    const html = await buildExportHtml('行内 $x^2$ 公式\n\n$$\nE = mc^2\n$$\n', {
      title: 'test',
      docPath: null
    })
    expect(html).toContain('class="katex"')
    expect(html).toContain('katex')
    expect(html).toContain('E = mc^2')
  })

  it('turns mermaid fences into pre.mermaid blocks', { timeout: 15_000 }, async () => {
    const html = await buildExportHtml('```mermaid\ngraph TD\n  A-->B\n```', {
      title: 'test',
      docPath: null
    })
    expect(html).toContain('class="mermaid"')
    expect(html).toContain('graph TD')
    expect(html).not.toContain('cdn.jsdelivr.net')
    expect(html).not.toContain('<script')
  })

  it('keeps language class on regular code blocks', async () => {
    const html = await buildExportHtml('```ts\nconst x = 1\n```', {
      title: 'test',
      docPath: null
    })
    expect(html).toContain('language-ts')
    expect(html).toContain('const x = 1')
  })

  it('keeps remote image URLs and embeds width styles', async () => {
    const html = await buildExportHtml('![logo](https://example.com/a.png =300)', {
      title: 'test',
      docPath: null
    })
    expect(html).toContain('src="https://example.com/a.png"')
    expect(html).toContain('width:300px')
    expect(html).toContain('alt="logo"')
  })

  it('escapes the document title', async () => {
    const html = await buildExportHtml('# hi', { title: 'a <b> & "c"', docPath: null })
    expect(html).toContain('&lt;b&gt;')
  })

  it('escapes raw HTML in markdown', async () => {
    const html = await buildExportHtml('<script>alert(1)</script>', {
      title: 'test',
      docPath: null
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('keeps safe inline HTML rendered while escaping unsafe HTML', async () => {
    const html = await buildExportHtml('<strong>safe</strong><script>alert(1)</script>', {
      title: 'test',
      docPath: null
    })
    expect(html).toContain('<strong>safe</strong>')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('alert(1)')
  })
})

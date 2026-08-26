import { describe, expect, it } from 'vitest'
import { buildExportHtml } from '../buildHtml'
import { beforeEach } from 'vitest'

beforeEach(() => {
  Object.defineProperty(window, 'markdownApp', { value: { mediaUrl: (value: string) => value }, configurable: true })
})

describe('geometry SVG export', () => {
  it('keeps geometry SVG image references in exported HTML', async () => {
    const html = await buildExportHtml('![几何图](assets/geometry.svg)', { title: 'geometry', docPath: 'C:/docs/guide.md' })
    expect(html).toContain('<img')
    expect(html).toContain('geometry.svg')
  })

  it('keeps URL-encoded geometry paths stable during export', async () => {
    const html = await buildExportHtml('![几何图](assets/my%20geometry.svg)', { title: 'geometry', docPath: 'C:/docs/guide.md' })
    expect(html).toContain('my%20geometry.svg')
  })
})

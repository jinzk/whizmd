import { describe, expect, it } from 'vitest'
import { resolveGeometryPath, sanitizeGeometrySvg } from '../geometryService'

describe('geometry save boundary', () => {
  it('accepts generated SVG and rejects executable SVG before IPC storage', () => {
    const generated = '<svg><metadata id="whizmd-geometry">{"version":1}</metadata></svg>'
    expect(sanitizeGeometrySvg(generated)).toBe(generated)
    expect(sanitizeGeometrySvg('<svg><script>bad()</script></svg>')).toBeNull()
  })

  it('resolves relative geometry paths beside the Markdown document', () => {
    expect(resolveGeometryPath('assets/geometry.svg', 'C:/docs/guide.md')).toMatch(/C:[\\/]docs[\\/]assets[\\/]geometry\.svg/)
    expect(resolveGeometryPath('C:/shared/geometry.svg', 'C:/docs/guide.md')).toMatch(/C:[\\/]shared[\\/]geometry\.svg/)
    expect(resolveGeometryPath('assets/geometry.svg', null)).toBeNull()
  })

  it('resolves media URLs used by unsaved geometry images', () => {
    expect(resolveGeometryPath('media:///C:/Users/alex/assets/geometry.svg', null)).toMatch(/C:[\\/]Users[\\/]alex[\\/]assets[\\/]geometry\.svg/)
  })

  it('distinguishes an existing relative geometry path from a new asset name', () => {
    const existing = resolveGeometryPath('assets/existing.svg', 'C:/docs/guide.md')
    expect(existing).toMatch(/C:[\\/]docs[\\/]assets[\\/]existing\.svg/)
    expect(resolveGeometryPath('geometry-new.svg', 'C:/docs/guide.md')).toMatch(/C:[\\/]docs[\\/]geometry-new\.svg/)
  })
})

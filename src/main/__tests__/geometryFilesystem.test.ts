import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveGeometryPath, sanitizeGeometrySvg } from '../geometryService'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))) })

describe('geometry filesystem boundaries', () => {
  it('writes and replaces geometry SVG content in a document asset directory', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'whizmd-geometry-'))
    roots.push(root)
    const docPath = join(root, 'guide.md')
    const assetDir = join(root, 'assets')
    const target = join(assetDir, 'geometry.svg')
    await fs.mkdir(assetDir)
    await fs.writeFile(target, '<svg>old</svg>', 'utf8')
    const safe = sanitizeGeometrySvg('<svg><metadata id="whizmd-geometry">new</metadata></svg>')
    await fs.writeFile(resolveGeometryPath('assets/geometry.svg', docPath)!, safe!, 'utf8')
    await expect(fs.readFile(target, 'utf8')).resolves.toContain('new')
  })

  it('rejects unsafe geometry content before writing', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'whizmd-geometry-'))
    roots.push(root)
    expect(sanitizeGeometrySvg('<svg><script>bad()</script></svg>')).toBeNull()
    await expect(fs.stat(root)).resolves.toBeDefined()
  })
})

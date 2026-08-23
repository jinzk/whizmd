import { promises as fs } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { prepareImages } from '../imageMigration'

const temporaryDirectories: string[] = []

async function createDocument(repository = false) {
  const root = await fs.mkdtemp(join(tmpdir(), 'whizmd-image-migration-'))
  temporaryDirectories.push(root)
  const docs = join(root, 'docs')
  await fs.mkdir(docs, { recursive: true })
  if (repository) await fs.mkdir(join(root, '.git'))
  const document = join(docs, 'guide.md')
  await fs.writeFile(document, '# Guide', 'utf8')
  return { root, docs, document }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe('prepareImages', () => {
  it('keeps repository images in relative paths, including parent directories', async () => {
    const { root, document } = await createDocument(true)
    const image = join(root, 'images', 'logo.png')
    await fs.mkdir(join(root, 'images'))
    await fs.writeFile(image, 'image')

    const content = `![Logo](${relative(join(root, 'docs'), image).replace(/\\/g, '/')})`
    const result = await prepareImages(content, document)

    expect(result).toBe(content)
    await expect(fs.stat(join(root, 'docs', 'assets'))).rejects.toThrow()
  })

  it('converts repository absolute and media references to GitHub-compatible relative paths', async () => {
    const { root, document } = await createDocument(true)
    const image = join(root, 'images', 'logo.png')
    await fs.mkdir(join(root, 'images'))
    await fs.writeFile(image, 'image')
    const mediaUrl = `media://${image.replace(/\\/g, '/')}`

    const result = await prepareImages(`![a](${image}) ![b](${mediaUrl})`, document)

    expect(result).toBe('![a](../images/logo.png) ![b](../images/logo.png)')
    await expect(fs.stat(join(root, 'docs', 'assets'))).rejects.toThrow()
  })

  it('migrates local images outside the repository into assets', async () => {
    const { root, document } = await createDocument()
    const externalRoot = join(root, '..', 'whizmd-external-root')
    const image = join(externalRoot, 'image.png')
    await fs.mkdir(externalRoot, { recursive: true })
    await fs.writeFile(image, 'external image')
    temporaryDirectories.push(externalRoot)
    const sourceRef = relative(join(root, 'docs'), image).replace(/\\/g, '/')
    const result = await prepareImages(`![External](${sourceRef})`, document)

    expect(result).toBe('![External](assets/image.png)')
    await expect(fs.readFile(join(join(document, '..'), 'assets', 'image.png'), 'utf8')).resolves.toBe('external image')
  })

  it('does not create assets when there is nothing to migrate', async () => {
    const { document, docs } = await createDocument()
    const result = await prepareImages('![Web](https://example.com/image.png) ![Data](data:image/png;base64,abc)', document)

    expect(result).toContain('https://example.com/image.png')
    await expect(fs.stat(join(docs, 'assets'))).rejects.toThrow()
  })

  it('does not overwrite an existing asset', async () => {
    const { root, document, docs } = await createDocument()
    const sourceRoot = join(root, '..', 'whizmd-source-root')
    await fs.mkdir(sourceRoot, { recursive: true })
    const source = join(sourceRoot, 'image.png')
    await fs.writeFile(source, 'new image')
    temporaryDirectories.push(source, sourceRoot)
    await fs.mkdir(join(docs, 'assets'))
    await fs.writeFile(join(docs, 'assets', 'image.png'), 'old image')

    const sourceRef = relative(docs, source).replace(/\\/g, '/')
    await prepareImages(`![Image](${sourceRef})`, document)

    await expect(fs.readFile(join(docs, 'assets', 'image.png'), 'utf8')).resolves.toBe('old image')
    await expect(fs.readFile(join(docs, 'assets', 'image-1.png'), 'utf8')).resolves.toBe('new image')
  })
})

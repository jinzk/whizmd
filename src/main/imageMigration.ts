import { promises as fs, existsSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { isSupportedImageName, sanitizeFileName, uniqueImageName } from './fileImages'

export type ImageMigrationOptions = {
  allowMediaDirectory?: (directory: string) => void
}

function normalizedPath(filePath: string): string {
  return resolve(filePath).toLowerCase()
}

function findRepositoryRoot(filePath: string): string | null {
  let current = resolve(dirname(filePath))
  while (true) {
    if (existsSync(join(current, '.git'))) return current
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function mediaReferenceToPath(value: string): string | null {
  if (!/^media:/i.test(value)) return null
  try {
    const url = new URL(value)
    const pathname = decodeURIComponent(url.pathname)
    if (/^[a-z]$/i.test(url.hostname)) return `${url.hostname}:${pathname}`
    return url.hostname ? `//${url.hostname}${pathname}` : pathname
  } catch {
    return null
  }
}


export async function prepareImages(
  content: string,
  docPath: string,
  options: ImageMigrationOptions = {}
): Promise<string> {
  const documentDir = dirname(docPath)
  const assetsDir = resolve(documentDir, 'assets')
  const normalizedDocumentDir = normalizedPath(documentDir)
  const repositoryRoot = findRepositoryRoot(docPath)
  const normalizedRepositoryRoot = repositoryRoot ? normalizedPath(repositoryRoot) : null
  const imageUrlPattern = /(!\[[^\]]*\]\()([^\s)]+)([^)]*\))/g
  const matches = [...content.matchAll(imageUrlPattern)]
  if (!matches.length) return content

  const resolveSourcePath = (sourceRef: string): string | null => {
    const mediaPath = mediaReferenceToPath(sourceRef)
    return mediaPath ?? (isAbsolute(sourceRef) ? sourceRef : resolve(documentDir, sourceRef))
  }

  const isRepositoryPath = (sourcePath: string): boolean => {
    if (!normalizedRepositoryRoot) return false
    const normalizedSource = normalizedPath(sourcePath)
    return normalizedSource === normalizedRepositoryRoot || normalizedSource.startsWith(`${normalizedRepositoryRoot}${sep}`)
  }

  const localMatches = matches.filter((match) => {
    const sourceRef = match[2]
    if (/^(?:https?:|data:|blob:)/i.test(sourceRef)) return false
    const sourcePath = resolveSourcePath(sourceRef)
    if (!sourcePath || !existsSync(sourcePath) || !isSupportedImageName(basename(sourcePath))) return false
    const normalizedSource = normalizedPath(sourcePath)
    const isInDocumentDirectory = normalizedSource === normalizedDocumentDir || normalizedSource.startsWith(`${normalizedDocumentDir}${sep}`)
    return !isInDocumentDirectory && !isRepositoryPath(sourcePath)
  })
  if (!localMatches.length) {
    let result = content
    for (const match of matches) {
      const sourceRef = match[2]
      const sourcePath = resolveSourcePath(sourceRef)
      if (!sourcePath || !isRepositoryPath(sourcePath) || (!/^media:/i.test(sourceRef) && !isAbsolute(sourceRef))) continue
      result = result.replace(match[0], `${match[1]}${relative(documentDir, sourcePath).replace(/\\/g, '/')}${match[3]}`)
    }
    return result
  }

  await fs.mkdir(assetsDir, { recursive: true })
  options.allowMediaDirectory?.(assetsDir)
  let result = content
  for (const match of localMatches) {
    const sourceRef = match[2]
    const sourcePath = resolveSourcePath(sourceRef)
    if (!sourcePath || !existsSync(sourcePath) || isRepositoryPath(sourcePath)) continue
    const fileName = sanitizeFileName(basename(sourcePath))
    const target = join(assetsDir, uniqueImageName(assetsDir, fileName))
    await fs.copyFile(sourcePath, target)
    result = result.replace(match[0], `${match[1]}${relative(documentDir, target).replace(/\\/g, '/')}${match[3]}`)
  }
  return result
}

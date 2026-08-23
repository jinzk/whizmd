import { existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'])

export function sanitizeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[\\/:*?"<>|]/g, '-')
  if (!cleaned || /^\s*$/.test(cleaned)) return 'pasted-image.png'
  const ext = extname(cleaned).toLowerCase()
  return IMAGE_EXTENSIONS.has(ext) ? cleaned : `${cleaned}.png`
}

export function isSupportedImageName(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(fileName).toLowerCase())
}

export function uniqueImageName(dir: string, fileName: string): string {
  const ext = extname(fileName)
  const stem = basename(fileName, ext)
  let candidate = fileName
  let index = 1
  while (existsSync(join(dir, candidate))) {
    candidate = `${stem}-${index}${ext}`
    index += 1
  }
  return candidate
}

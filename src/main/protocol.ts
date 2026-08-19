import { app, protocol, net } from 'electron'
import { extname, normalize, sep } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const MEDIA_SCHEME = 'media'

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.bmp',
  '.ico',
  '.avif'
])

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif'
}

const allowedMediaRoots = new Set<string>()
const allowedMediaFiles = new Set<string>()

export function allowMediaDirectory(directory: string): void {
  allowedMediaRoots.add(normalize(directory).replace(/[\\/]$/, '').toLowerCase())
}

export function allowMediaFile(filePath: string): void {
  allowedMediaFiles.add(normalize(filePath).toLowerCase())
}

function isAllowedMediaPath(filePath: string): boolean {
  const normalized = normalize(filePath).toLowerCase()
  return [...allowedMediaRoots].some(
    (root) => normalized === root || normalized.startsWith(`${root}${sep}`)
  ) || allowedMediaFiles.has(normalized)
}

/**
 * Must run before app.whenReady(). Registers the scheme as privileged so that
 * relative URL resolution, fetch and streaming work in the sandboxed renderer.
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true
      }
    }
  ])
}

/**
 * Must run after app.whenReady(). Serves local image files referenced through
 * the media:// scheme. The absolute path is carried in the pathname in the
 * same form as a file: URL (`media:///C:/Users/...`).
 */
export function registerMediaProtocol(): void {
  allowMediaDirectory(app.getPath('userData'))
  protocol.handle(MEDIA_SCHEME, (request) => {
    try {
       const url = new URL(request.url)
       const decodedPath = decodeURIComponent(url.pathname)
       const fileUrl = `file://${decodedPath}`
       const absolutePath = fileURLToPath(fileUrl)

      const ext = extname(absolutePath).toLowerCase()
       if (!IMAGE_EXTENSIONS.has(ext)) {
         return new Response('Not an image', { status: 403 })
       }
       if (!isAllowedMediaPath(absolutePath)) {
         return new Response('Forbidden', { status: 403 })
       }
      if (!existsSync(absolutePath)) {
        return new Response('File not found', { status: 404 })
      }

      return net.fetch(pathToFileURL(absolutePath).toString(), {
        headers: { 'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream' }
      })
    } catch {
      return new Response('Bad request', { status: 400 })
    }
  })
}

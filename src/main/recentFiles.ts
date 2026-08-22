import { app } from 'electron'
import { existsSync, promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { RecentState } from '../shared/types'
import { addRecentPath, cleanRecentPaths } from './recentFilesUtils'

let cache: RecentState | null = null

function filePath(): string {
  return join(app.getPath('userData'), 'recent.json')
}

export async function getRecent(): Promise<RecentState> {
  if (cache) return cache
  try {
    const parsed = JSON.parse(await fs.readFile(filePath(), 'utf-8')) as Partial<RecentState>
    const files = cleanRecentPaths(Array.isArray(parsed.files) ? parsed.files.filter((item): item is string => typeof item === 'string') : [], existsSync)
    const folders = cleanRecentPaths(Array.isArray(parsed.folders) ? parsed.folders.filter((item): item is string => typeof item === 'string') : [], existsSync)
    cache = { files, folders }
    if (files.length !== parsed.files?.length || folders.length !== parsed.folders?.length) {
      await fs.writeFile(filePath(), JSON.stringify(cache, null, 2), 'utf-8')
    }
  } catch {
    cache = { files: [], folders: [] }
  }
  return cache
}

export async function addRecentFile(path: string): Promise<RecentState> {
  const recent = await getRecent()
  recent.files = addRecentPath(recent.files, path, 10)
  await fs.writeFile(filePath(), JSON.stringify(recent, null, 2), 'utf-8')
  return recent
}

export async function removeRecentFile(path: string): Promise<RecentState> {
  const recent = await getRecent()
  recent.files = recent.files.filter((item) => item !== path)
  await fs.writeFile(filePath(), JSON.stringify(recent, null, 2), 'utf-8')
  return recent
}

export async function removeRecentFolder(path: string): Promise<RecentState> {
  const recent = await getRecent()
  recent.folders = recent.folders.filter((item) => item !== path)
  await fs.writeFile(filePath(), JSON.stringify(recent, null, 2), 'utf-8')
  return recent
}

export async function addRecentFolder(path: string): Promise<RecentState> {
  const recent = await getRecent()
  recent.folders = addRecentPath(recent.folders, path, 10)
  await fs.writeFile(filePath(), JSON.stringify(recent, null, 2), 'utf-8')
  return recent
}

export async function clearRecent(): Promise<RecentState> {
  cache = { files: [], folders: [] }
  await fs.writeFile(filePath(), JSON.stringify(cache, null, 2), 'utf-8')
  return cache
}

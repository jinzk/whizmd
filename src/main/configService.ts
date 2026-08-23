import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { AppConfig } from '../shared/types'

const DEFAULT_CONFIG: AppConfig = {
  themeMode: 'system',
  language: 'system',
  assetsDir: 'assets',
  imagePathStrategy: 'relative',
  autoSave: false,
  autoSaveDelay: 1000,
  editorFontSize: 16,
  editorContentWidth: 800,
  spellCheck: false,
  showMarkdownOnly: true
}

let configCache: AppConfig | null = null

function configFilePath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function validateConfig(config: AppConfig): AppConfig {
  config.assetsDir = 'assets'
  config.imagePathStrategy = 'relative'
  if (!['light', 'dark', 'system'].includes(config.themeMode)) config.themeMode = DEFAULT_CONFIG.themeMode
  if (!['system', 'zh-CN', 'en-US'].includes(config.language)) config.language = DEFAULT_CONFIG.language
  if (![500, 1000, 3000].includes(config.autoSaveDelay)) config.autoSaveDelay = DEFAULT_CONFIG.autoSaveDelay
  if (![14, 16, 18].includes(config.editorFontSize)) config.editorFontSize = DEFAULT_CONFIG.editorFontSize
  if (![680, 800, 960].includes(config.editorContentWidth)) config.editorContentWidth = DEFAULT_CONFIG.editorContentWidth
  if (typeof config.autoSave !== 'boolean') config.autoSave = DEFAULT_CONFIG.autoSave
  if (typeof config.spellCheck !== 'boolean') config.spellCheck = DEFAULT_CONFIG.spellCheck
  if (typeof config.showMarkdownOnly !== 'boolean') config.showMarkdownOnly = DEFAULT_CONFIG.showMarkdownOnly
  return config
}

export async function getConfig(): Promise<AppConfig> {
  if (configCache) return configCache
  try {
    const raw = await fs.readFile(configFilePath(), 'utf-8')
    configCache = validateConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) } as AppConfig)
  } catch {
    configCache = { ...DEFAULT_CONFIG }
  }
  return configCache
}

export async function setConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  if (patch.assetsDir !== undefined && patch.assetsDir !== 'assets') throw new Error('assetsDir is fixed to assets')
  if (patch.themeMode !== undefined && !['light', 'dark', 'system'].includes(patch.themeMode)) throw new Error('Invalid theme mode')
  if (patch.language !== undefined && !['system', 'zh-CN', 'en-US'].includes(patch.language)) throw new Error('Invalid language')
  if (patch.imagePathStrategy !== undefined && patch.imagePathStrategy !== 'relative') throw new Error('Only relative image paths are supported')
  if (patch.autoSave !== undefined && typeof patch.autoSave !== 'boolean') throw new Error('Invalid auto-save setting')
  if (patch.spellCheck !== undefined && typeof patch.spellCheck !== 'boolean') throw new Error('Invalid spell-check setting')
  if (patch.showMarkdownOnly !== undefined && typeof patch.showMarkdownOnly !== 'boolean') throw new Error('Invalid file filter setting')
  if (patch.autoSaveDelay !== undefined && ![500, 1000, 3000].includes(patch.autoSaveDelay)) throw new Error('Invalid auto-save delay')
  if (patch.editorFontSize !== undefined && ![14, 16, 18].includes(patch.editorFontSize)) throw new Error('Invalid editor font size')
  if (patch.editorContentWidth !== undefined && ![680, 800, 960].includes(patch.editorContentWidth)) throw new Error('Invalid editor content width')
  const next = { ...(await getConfig()), ...patch }
  configCache = validateConfig(next)
  await fs.writeFile(configFilePath(), JSON.stringify(configCache, null, 2), 'utf-8')
  return configCache
}

export async function dialogLanguage(): Promise<'zh-CN' | 'en-US'> {
  const config = await getConfig()
  if (config.language !== 'system') return config.language
  return /^zh(?:-|$)/i.test(app.getLocale()) ? 'zh-CN' : 'en-US'
}

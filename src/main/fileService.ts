import { promises as fs } from 'node:fs'

export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

export async function writeTextFile(filePath: string, content: string): Promise<string> {
  const tempPath = `${filePath}.markdownapp-${process.pid}-${Date.now()}.tmp`
  await fs.writeFile(tempPath, content, 'utf-8')
  await fs.rename(tempPath, filePath)
  return filePath
}

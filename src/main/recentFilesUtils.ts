export function addRecentPath(paths: string[], path: string, limit: number): string[] {
  return [path, ...paths.filter((item) => item !== path)].slice(0, limit)
}

export function cleanRecentPaths(paths: string[], exists: (path: string) => boolean): string[] {
  return [...new Set(paths)].filter(exists)
}

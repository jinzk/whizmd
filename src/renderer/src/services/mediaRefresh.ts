const versions = new Map<string, number>()
const listeners = new Set<() => void>()

export function bumpMediaVersion(src: string): void {
  versions.set(src, (versions.get(src) ?? 0) + 1)
  for (const listener of listeners) listener()
}

export function currentMediaVersion(src: string): number {
  return versions.get(src) ?? 0
}

export function subscribeMediaRefresh(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetMediaVersions(): void {
  versions.clear()
}
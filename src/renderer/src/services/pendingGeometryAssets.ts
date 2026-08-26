export type PendingGeometryAsset = { id: string; svg: string; previousRef: string }

const store = new Map<string, PendingGeometryAsset[]>()

export function addPendingGeometryAsset(docId: string, asset: PendingGeometryAsset): void {
  const list = store.get(docId) ?? []
  list.push(asset)
  store.set(docId, list)
}

export function consumePendingGeometryAssets(docId: string): PendingGeometryAsset[] {
  const list = store.get(docId) ?? []
  store.delete(docId)
  return list
}

export function peekPendingGeometryCount(docId: string): number {
  return (store.get(docId) ?? []).length
}

export function clearPendingGeometryAssets(docId: string): void {
  store.delete(docId)
}

import type { GeometryDocument } from './model'

export type GeometryHistory = { past: GeometryDocument[]; future: GeometryDocument[] }

export function createGeometryHistory(): GeometryHistory { return { past: [], future: [] } }

export function recordGeometryChange(history: GeometryHistory, before: GeometryDocument): GeometryHistory {
  return { past: [...history.past, before], future: [] }
}

export function undoGeometry(history: GeometryHistory, current: GeometryDocument): { history: GeometryHistory; document: GeometryDocument } | null {
  const document = history.past.at(-1)
  if (!document) return null
  return { history: { past: history.past.slice(0, -1), future: [...history.future, current] }, document }
}

export function redoGeometry(history: GeometryHistory, current: GeometryDocument): { history: GeometryHistory; document: GeometryDocument } | null {
  const document = history.future.at(-1)
  if (!document) return null
  return { history: { past: [...history.past, current], future: history.future.slice(0, -1) }, document }
}

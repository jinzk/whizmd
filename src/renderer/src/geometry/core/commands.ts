import type { GeometryDocument } from './model'

export type GeometryCommand = {
  label: string
  apply(document: GeometryDocument): GeometryDocument
}

export type GeometryCommandHistory = { past: GeometryDocument[]; future: GeometryDocument[] }

export function createCommandHistory(): GeometryCommandHistory { return { past: [], future: [] } }

export function executeGeometryCommand(history: GeometryCommandHistory, document: GeometryDocument, command: GeometryCommand): { history: GeometryCommandHistory; document: GeometryDocument } {
  return { history: { past: [...history.past, document], future: [] }, document: command.apply(document) }
}

export function undoGeometryCommand(history: GeometryCommandHistory, document: GeometryDocument): { history: GeometryCommandHistory; document: GeometryDocument } | null {
  const previous = history.past.at(-1)
  if (!previous) return null
  return { history: { past: history.past.slice(0, -1), future: [document, ...history.future] }, document: previous }
}

export function redoGeometryCommand(history: GeometryCommandHistory, document: GeometryDocument): { history: GeometryCommandHistory; document: GeometryDocument } | null {
  const next = history.future[0]
  if (!next) return null
  return { history: { past: [...history.past, document], future: history.future.slice(1) }, document: next }
}

export function createDocumentCommand(label: string, apply: (document: GeometryDocument) => GeometryDocument): GeometryCommand { return { label, apply } }

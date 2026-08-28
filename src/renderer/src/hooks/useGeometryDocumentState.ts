import { useRef, useState } from 'react'
import {
  createCommandHistory,
  createDocumentCommand,
  executeGeometryCommand,
  moveAttachedPoints,
  rebuildGeometryGraphs,
  redoGeometryCommand,
  undoGeometryCommand
} from '../geometry'
import type { GeometryCommandHistory } from '../geometry/core/commands'
import type { GeometryDocument } from '../geometry/core/model'

export function useGeometryDocumentState(initialDocument: GeometryDocument): {
  document: GeometryDocument
  documentRef: React.MutableRefObject<GeometryDocument>
  history: GeometryCommandHistory
  setHistory: React.Dispatch<React.SetStateAction<GeometryCommandHistory>>
  updateDocument: (next: GeometryDocument) => void
  previewDocument: (next: GeometryDocument) => void
  commit: (next: GeometryDocument) => void
  undo: () => void
  redo: () => void
} {
  const [document, setDocument] = useState(initialDocument)
  const documentRef = useRef(document)
  const [history, setHistory] = useState(createCommandHistory)

  const updateDocument = (next: GeometryDocument): void => {
    const indexed = rebuildGeometryGraphs(moveAttachedPoints(documentRef.current, next))
    documentRef.current = indexed
    setDocument(indexed)
  }

  const commit = (next: GeometryDocument): void => {
    setHistory((current) => executeGeometryCommand(current, documentRef.current, createDocumentCommand('update', () => next)).history)
    updateDocument(next)
  }

  const undo = (): void => {
    const result = undoGeometryCommand(history, documentRef.current)
    if (!result) return
    setHistory(result.history)
    updateDocument(result.document)
  }

  const redo = (): void => {
    const result = redoGeometryCommand(history, documentRef.current)
    if (!result) return
    setHistory(result.history)
    updateDocument(result.document)
  }

  return { document, documentRef, history, setHistory, updateDocument, previewDocument: updateDocument, commit, undo, redo }
}

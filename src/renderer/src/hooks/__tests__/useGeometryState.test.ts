import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createGeometryDocument, addPoint } from '../../geometry'
import { useGeometryDocumentState } from '../useGeometryDocumentState'
import { useGeometrySelectionState } from '../useGeometrySelectionState'
import { useGeometryToolState } from '../useGeometryToolState'

describe('geometry state hooks', () => {
  it('keeps document state and history synchronized across commit, undo, and redo', () => {
    const initial = createGeometryDocument()
    const { result } = renderHook(() => useGeometryDocumentState(initial))
    const next = addPoint(initial, 100, 120, 'P1')

    act(() => result.current.commit(next))
    expect(result.current.document.points).toHaveLength(1)
    expect(result.current.history.past).toHaveLength(1)

    act(() => result.current.undo())
    expect(result.current.document.points).toHaveLength(0)
    expect(result.current.history.future).toHaveLength(1)

    act(() => result.current.redo())
    expect(result.current.document.points).toHaveLength(1)
  })

  it('starts selection and construction state empty', () => {
    const { result } = renderHook(() => useGeometrySelectionState())
    expect(result.current.selectedId).toBeNull()
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.selectedObjectsRef.current).toEqual([])
    expect(result.current.constructionSelectionCount).toBe(0)
  })

  it('initializes all drawing previews as empty', () => {
    const { result } = renderHook(() => useGeometryToolState())
    expect(result.current.shapeAnchor).toBeNull()
    expect(result.current.segmentCursor).toBeNull()
    expect(result.current.polygonSession.vertexIds).toEqual([])
    expect(result.current.textDraft).toBeNull()
    expect(result.current.arcStage).toBe(0)
    expect(result.current.ellipsePreview).toBeNull()
  })
})

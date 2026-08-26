import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useGeometryDrag } from '../useGeometryDrag'

describe('useGeometryDrag', () => {
  it('routes window mouse events and cleans them up after mouseup', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const { result } = renderHook(() => useGeometryDrag())

    act(() => result.current.beginWindowDrag(onMove, onEnd))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 12, clientY: 18 }))
    window.dispatchEvent(new MouseEvent('mouseup'))
    window.dispatchEvent(new MouseEvent('mousemove'))

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ clientX: 12, clientY: 18 }))
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('cancels the previous drag before starting another one', () => {
    const firstMove = vi.fn()
    const secondMove = vi.fn()
    const { result } = renderHook(() => useGeometryDrag())

    act(() => result.current.beginWindowDrag(firstMove))
    act(() => result.current.beginWindowDrag(secondMove))
    window.dispatchEvent(new MouseEvent('mousemove'))

    expect(firstMove).not.toHaveBeenCalled()
    expect(secondMove).toHaveBeenCalledTimes(1)
  })
})

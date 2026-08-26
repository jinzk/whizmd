import { describe, expect, it } from 'vitest'
import { addPendingGeometryAsset, clearPendingGeometryAssets, consumePendingGeometryAssets, peekPendingGeometryCount } from '../pendingGeometryAssets'

describe('pending geometry assets', () => {
  it('stages and consumes per-document assets in order', () => {
    addPendingGeometryAsset('doc1', { id: 'a', svg: '<svg/>', previousRef: 'C:/tmp/a.svg' })
    addPendingGeometryAsset('doc1', { id: 'b', svg: '<svg>b</svg>', previousRef: 'C:/tmp/b.svg' })
    expect(peekPendingGeometryCount('doc1')).toBe(2)
    const consumed = consumePendingGeometryAssets('doc1')
    expect(consumed.map((item) => item.id)).toEqual(['a', 'b'])
    expect(peekPendingGeometryCount('doc1')).toBe(0)
  })

  it('isolates documents and supports discard', () => {
    addPendingGeometryAsset('docA', { id: 'x', svg: '<svg/>', previousRef: 'x' })
    clearPendingGeometryAssets('docB')
    expect(peekPendingGeometryCount('docB')).toBe(0)
    clearPendingGeometryAssets('docA')
    expect(peekPendingGeometryCount('docA')).toBe(0)
  })
})

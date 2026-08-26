import { describe, expect, it } from 'vitest'
import { createGeometryDocument, createGeometryHistory, recordGeometryChange, redoGeometry, undoGeometry } from '../index'

describe('geometry history', () => {
  it('records, undoes, and redoes document snapshots', () => {
    const first = createGeometryDocument()
    const second = { ...first, width: 900 }
    const history = recordGeometryChange(createGeometryHistory(), first)
    const undone = undoGeometry(history, second)
    expect(undone?.document).toBe(first)
    const redone = redoGeometry(undone!.history, first)
    expect(redone?.document).toBe(second)
  })
})

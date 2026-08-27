import { describe, expect, it } from 'vitest'
import { addPoint, createGeometryDocument, createDocumentCommand, createCommandHistory, executeGeometryCommand, undoGeometryCommand } from '../index'

describe('geometry commands', () => {
  it('executes and undoes one atomic document change', () => {
    const document = createGeometryDocument()
    const result = executeGeometryCommand(createCommandHistory(), document, createDocumentCommand('add point', (current) => addPoint(current, 10, 20)))
    expect(result.document.points).toHaveLength(1)
    expect(undoGeometryCommand(result.history, result.document)?.document).toEqual(document)
  })
})

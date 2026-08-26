import { describe, expect, it } from 'vitest'
import { addPoint, createGeometryDocument } from '../core/model'
import { rotateAboutPivot, scaleAboutAnchor, transformVertices } from '../core/transforms'
import type { GeometryDocument } from '../index'

function square(): GeometryDocument {
  let document = createGeometryDocument()
  for (const [x, y] of [[0, 0], [100, 0], [100, 100], [0, 100]]) document = addPoint(document, x, y)
  return document
}

describe('vertex transforms', () => {
  it('scales vertices about an anchor keeping it fixed', () => {
    const result = scaleAboutAnchor(square(), ['P1', 'P2', 'P3', 'P4'], { x: 0, y: 0 }, 2)
    expect(result.objects.find((object) => object.id === 'P1')).toMatchObject({ x: 0, y: 0 })
    expect(result.objects.find((object) => object.id === 'P2')).toMatchObject({ x: 200, y: 0 })
    expect(result.objects.find((object) => object.id === 'P3')).toMatchObject({ x: 200, y: 200 })
  })

  it('rotates vertices about a pivot preserving distances to it', () => {
    const result = rotateAboutPivot(square(), ['P1'], { x: 50, y: 50 }, Math.PI / 2)
    const p1 = result.objects.find((object) => object.id === 'P1')
    if (!p1 || p1.type !== 'point') return
    expect(p1.x).toBeCloseTo(100, 6)
    expect(p1.y).toBeCloseTo(0, 6)
    expect(Math.hypot(p1.x - 50, p1.y - 50)).toBeCloseTo(Math.hypot(50, 50), 6)
  })

  it('skips unknown vertex ids and leaves other points untouched', () => {
    let document = square()
    document = addPoint(document, -50, -50)
    const before = JSON.stringify(document.objects.find((object) => object.id === 'P5'))
    const result = transformVertices(document, ['P1', 'missing'], () => ({ x: 9, y: 9 }))
    expect(result.objects.find((object) => object.id === 'P1')).toMatchObject({ x: 9, y: 9 })
    expect(JSON.stringify(result.objects.find((object) => object.id === 'P5'))).toBe(before)
  })
})

import { describe, expect, it } from 'vitest'
import { addPoint, addSegment, createGeometryDocument, renderGeometrySvg, setPointStyle, setSegmentStyle } from '../index'

describe('geometry SVG styles', () => {
  it('serializes point size/color and segment stroke styles', () => {
    let document = addPoint(createGeometryDocument(), 0, 0)
    document = addPoint(document, 100, 0)
    document = addSegment(document, 'P1', 'P2')
    document = setPointStyle(document, 'P1', { color: '#ff0000', size: 7 })
    document = setSegmentStyle(document, 'S1', { color: '#00ff00', lineWidth: 3, lineStyle: 'dotted' })
    const svg = renderGeometrySvg(document)
    expect(svg).toContain('r="7" fill="#ff0000"')
    expect(svg).toContain('stroke="#00ff00" stroke-width="3"')
    expect(svg).toContain('stroke-dasharray="2 5"')
    expect(svg).toContain('"color":"#ff0000"')
  })
})

import { describe, expect, it } from 'vitest'
import { addCircle, addEllipse, addPoint, addSegment, createGeometryDocument, renderGeometrySvg, setCurveStyle, setPointStyle, setSegmentStyle } from '../index'

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

  it('applies curve stroke styles to circle and ellipse', () => {
    let document = addPoint(createGeometryDocument(), 50, 50)
    document = addPoint(document, 100, 50)
    document = addCircle(document, 'P1', 40)
    document = addEllipse(document, 'P1', 'P2', 60)
    document = setCurveStyle(document, 'C1', { color: '#ff0000', lineWidth: 4, lineStyle: 'dashed' })
    document = setCurveStyle(document, 'E1', { color: '#00ff00', lineWidth: 3, lineStyle: 'dotted' })
    const svg = renderGeometrySvg(document)
    expect(svg).toContain('<circle cx="50" cy="50" r="40" fill="none" stroke="#ff0000" stroke-width="4" stroke-dasharray="8 6"')
    expect(svg).toContain('stroke="#00ff00" stroke-width="3" stroke-dasharray="2 5"')
  })
})

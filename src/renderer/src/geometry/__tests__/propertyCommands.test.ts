import { describe, expect, it } from 'vitest'
import { addCircle, addEllipse, addPoint, addSegment, createGeometryDocument, setArcProperties, setCircleRadius, setEllipseSemiMajor, setPointCoordinates, setPointLabel, setSegmentLength, setTextValue, setVertexAngle } from '../index'

describe('geometry property commands', () => {
  it('updates point and text properties without changing unrelated objects', () => {
    let document = addPoint(createGeometryDocument(), 10, 20)
    document = addPoint(document, 30, 40)
    document = setPointCoordinates(document, 'P1', 50, 60)
    document = setPointLabel(document, 'P1', 'A')
    document = setTextValue({ ...document, objects: [...document.objects, { type: 'text', id: 'T1', x: 0, y: 0, text: 'old' }] }, 'T1', 'new')
    expect(document.objects.find((object) => object.id === 'P1')).toMatchObject({ x: 50, y: 60, label: 'A' })
    expect(document.objects.find((object) => object.id === 'P2')).toMatchObject({ x: 30, y: 40 })
    expect(document.objects.find((object) => object.id === 'T1')).toMatchObject({ text: 'new' })
  })

  it('updates circle and arc properties', () => {
    let document = addPoint(createGeometryDocument(), 0, 0)
    document = addCircle(document, 'P1', 20)
    document = setCircleRadius(document, 'C1', 40)
    document = { ...document, objects: [...document.objects, { type: 'arc', id: 'A1', center: 'P1', radius: 10, startAngle: 0, endAngle: 1 }] }
    document = setArcProperties(document, 'A1', { radius: 30, endAngle: 2 })
    document = addPoint(document, 100, 0)
    document = addEllipse(document, 'P1', 'P2', 80)
    document = setEllipseSemiMajor(document, 'E1', 100)
    expect(document.objects.find((object) => object.id === 'C1')).toMatchObject({ radius: 40 })
    expect(document.objects.find((object) => object.id === 'A1')).toMatchObject({ radius: 30, endAngle: 2 })
    expect(document.objects.find((object) => object.id === 'E1')).toMatchObject({ semiMajor: 100 })
  })

  it('adds or updates a segment length constraint and vertex angle constraint', () => {
    let document = addPoint(createGeometryDocument(), 0, 0)
    document = addPoint(document, 20, 0)
    document = addPoint(document, 20, 20)
    document = addSegment(document, 'P1', 'P2')
    document = addSegment(document, 'P2', 'P3')
    document = setSegmentLength(document, 'S1', 50)
    document = setSegmentLength(document, 'S1', 60)
    document = setVertexAngle(document, 'P2', 'P1', 'P3', 1, 45)
    expect(document.constraints.filter((constraint) => constraint.type === 'fixedDistance')).toHaveLength(1)
    expect(document.constraints.find((constraint) => constraint.type === 'fixedDistance')).toMatchObject({ value: 60 })
    expect(document.constraints.find((constraint) => constraint.type === 'fixedAngle')).toMatchObject({ vertex: 'P2', value: Math.PI / 4 })
  })
})

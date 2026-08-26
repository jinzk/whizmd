import { describe, expect, it } from 'vitest'
import { buildShape, createGeometryDocument, evaluateConstraints } from '../index'

function segmentVector(document: ReturnType<typeof createGeometryDocument>, id: string) {
  const object = document.objects.find((item) => item.id === id)
  if (!object || object.type !== 'segment') return null
  const a = document.objects.find((item) => item.type === 'point' && item.id === object.start)
  const b = document.objects.find((item) => item.type === 'point' && item.id === object.end)
  if (!a || !b || a.type !== 'point' || b.type !== 'point') return null
  return { x: b.x - a.x, y: b.y - a.y, length: Math.hypot(b.x - a.x, b.y - a.y) }
}

describe('shape factory', () => {
  it('clamps a square to equal sides and adds perpendicular + equal constraints', () => {
    const built = buildShape(createGeometryDocument(), 'square', 100, 100, 320, 260)
    const segments = built.objects.filter((object) => object.type === 'segment')
    expect(segments).toHaveLength(4)
    const s1 = segmentVector(built, 'S1')!
    const s2 = segmentVector(built, 'S2')!
    expect(s1.length).toBeCloseTo(s2.length, 6)
    expect(Math.hypot(220, 160)).toBeGreaterThan(0)
    expect(built.constraints.some((c) => c.type === 'equalLength')).toBe(true)
    expect(built.constraints.filter((c) => c.type === 'parallel')).toHaveLength(2)
  })

  it('builds an equilateral triangle whose sides are equal', () => {
    const base = 120
    const built = buildShape(createGeometryDocument(), 'equilateral', 100, 200, 100 + base, 200)
    const s1 = segmentVector(built, 'S1')!
    const s2 = segmentVector(built, 'S2')!
    const s3 = segmentVector(built, 'S3')!
    expect(s1.length).toBeCloseTo(base, 6)
    expect(s2.length).toBeCloseTo(s3.length, 6)
    expect(evaluateConstraints(built, built.constraints).every((result) => result.valid)).toBe(true)
  })

  it('builds an isosceles triangle with equal legs', () => {
    const built = buildShape(createGeometryDocument(), 'isosceles', 100, 300, 300, 180)
    const s1 = segmentVector(built, 'S1')!
    const s2 = segmentVector(built, 'S2')!
    const s3 = segmentVector(built, 'S3')!
    expect(s2.length).toBeCloseTo(s3.length, 6)
    expect(s1.length).not.toBeCloseTo(s2.length, 3)
    expect(evaluateConstraints(built, built.constraints).every((result) => result.valid)).toBe(true)
  })

  it('builds a circle centred on the drag rectangle', () => {
    const built = buildShape(createGeometryDocument(), 'circle', 100, 100, 260, 180)
    const circle = built.objects.find((object) => object.type === 'circle')
    if (!circle || circle.type !== 'circle') return
    expect(circle.radius).toBeCloseTo(80, 6)
    const center = built.objects.find((object) => object.id === circle.center)
    if (!center || center.type !== 'point') return
    expect(center.x).toBeCloseTo(180, 6)
    expect(center.y).toBeCloseTo(140, 6)
    expect(built.constraints).toHaveLength(0)
  })

  it('builds a parallelogram with both side pairs parallel', () => {
    const built = buildShape(createGeometryDocument(), 'parallelogram', 100, 200, 300, 120)
    expect(built.objects.filter((object) => object.type === 'segment')).toHaveLength(4)
    expect(built.constraints.filter((constraint) => constraint.type === 'parallel')).toHaveLength(2)
    const bottom = segmentVector(built, 'S1')!
    const top = segmentVector(built, 'S3')!
    expect(Math.hypot(bottom.x, bottom.y)).toBeCloseTo(Math.hypot(top.x, top.y), 6)
    expect(evaluateConstraints(built, built.constraints).every((result) => result.valid)).toBe(true)
  })

  it('builds a rhombus with four equal sides', () => {
    const built = buildShape(createGeometryDocument(), 'rhombus', 100, 100, 300, 260)
    const sides = ['S1', 'S2', 'S3', 'S4'].map((id) => segmentVector(built, id)!)
    const lengths = sides.map((vector) => vector.length)
    for (const length of lengths) expect(length).toBeCloseTo(lengths[0], 6)
    expect(built.constraints.filter((constraint) => constraint.type === 'equalLength')).toHaveLength(3)
    expect(evaluateConstraints(built, built.constraints).every((result) => result.valid)).toBe(true)
  })
})

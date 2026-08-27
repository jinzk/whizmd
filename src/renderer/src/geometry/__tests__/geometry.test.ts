import { describe, expect, it } from 'vitest'
import { addArc, addCircle, addConstraint, addEllipse, addPoint, addSegment, addText, checkMergePoints, createGeometryDocument, deserializeGeometry, deserializeGeometrySvg, getGeometryCurves, getGeometryObject, getGeometryObjects, getNodeIncidents, isTopologyNode, mergePoints, mergePointsTopology, mergePointsWithConstraints, rebuildGeometryGraphs, removeObject, renderGeometrySvg, resizeCircle, resolveEllipseGeometry, resolvePoint, sanitizeGeometrySvg, serializeGeometry } from '../index'

describe('geometry module', () => {
  it('creates and round-trips a geometry document', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 20, 30, 'A')
    const parsed = deserializeGeometry(serializeGeometry(document))
    expect(parsed).toEqual(document)
  })

  it('provides typed object access without exposing lookup details', () => {
    const document = addPoint(createGeometryDocument(), 10, 20)
    expect(getGeometryObject(document, 'P1')).toMatchObject({ type: 'point', x: 10, y: 20 })
    expect(getGeometryObject(document, 'missing')).toBeUndefined()
  })

  it('serializes structured collections without the legacy objects array', () => {
    const document = addPoint(createGeometryDocument(), 10, 20, 'A')
    const serialized = serializeGeometry(document)
    expect(JSON.parse(serialized).objects).toBeUndefined()
    expect(deserializeGeometry(serialized)).toEqual(document)
  })

  it('keeps every geometry type in its authoritative collection', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0)
    document = addPoint(document, 100, 0)
    document = addSegment(document, 'P1', 'P2')
    document = addCircle(document, 'P1', 25)
    document = addArc(document, 'P1', 25, 0, Math.PI / 2)
    document = addEllipse(document, 'P1', 'P2', 60)
    document = addText(document, 10, 10, 'label')
    expect(document.points.map((item) => item.type)).toEqual(['point', 'point'])
    expect(document.segments.map((item) => item.type)).toEqual(['segment'])
    expect(document.curves.map((item) => item.type)).toEqual(['circle', 'arc', 'ellipse'])
    expect(document.annotations.map((item) => item.type)).toEqual(['text'])
    expect(JSON.stringify(document)).not.toContain('"objects"')
  })

  it('rejects invalid serialized geometry without throwing', () => {
    expect(deserializeGeometry('not-json')).toBeNull()
    expect(deserializeGeometry(JSON.stringify({ version: 2 }))).toBeNull()
    expect(deserializeGeometry(JSON.stringify({ version: 1, points: 'invalid' }))).toBeNull()
  })

  it('performs topology-only point rebinding without changing coordinates or constraints', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0)
    document = addSegment(document, 'P1', 'P2')
    document = addConstraint(document, { type: 'fixedDistance', a: 'P1', b: 'P2', value: 10 })
    const merged = mergePointsTopology(document, 'P1', 'P2')
    expect(getGeometryObject(merged, 'P2')).toBeUndefined()
    expect(getGeometryObjects(merged, 'segment')[0]).toMatchObject({ start: 'P1', end: 'P1' })
    expect(merged.constraints).toEqual([{ type: 'fixedDistance', a: 'P1', b: 'P1', value: 10 }])
    expect(resolvePoint(merged, 'P1')).toMatchObject({ x: 0, y: 0 })
  })

  it('runs the topology merge pipeline and rebuilds graph indexes', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 0, 0)
    document = addConstraint(document, { type: 'coincident', pointA: 'P1', pointB: 'P2' })
    const merged = mergePointsWithConstraints(document, 'P1', 'P2')
    expect(merged.constraints).toEqual([])
    expect(merged.sharedNodes).toEqual([{ id: 'P1', memberIds: [] }])
    expect(merged.dependencies).toEqual([])
  })


  it('round-trips optional shape ownership metadata', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0, 'P1', { ownerId: 'shape-R1', role: 'boundary' })
    document = addPoint(document, 10, 0, 'P2', { ownerId: 'shape-R1', role: 'boundary' })
    document = addSegment(document, 'P1', 'P2', { ownerId: 'shape-R1', role: 'boundary' })
    expect(deserializeGeometry(serializeGeometry(document))).toEqual(document)
  })

  it('builds shared-node and dependency graph indexes', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addSegment(document, 'P1', 'P2')
    document = addPoint(document, 5, 0); document = addConstraint(document, { type: 'midpoint', point: 'P3', line: 'S1' })
    const indexed = rebuildGeometryGraphs(document)
    expect(indexed.sharedNodes.find((node) => node.id === 'P1')).toEqual({ id: 'P1', memberIds: ['S1'] })
    expect(indexed.dependencies).toEqual([{ id: 'D1', sourceId: 'P3', dependencyIds: ['S1'], kind: 'midpoint' }])
  })

  it('rebuilds dependency indexes after a point-on-line constraint is added', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 5, 0)
    document = addSegment(document, 'P1', 'P2')
    document = addConstraint(document, { type: 'pointOnLine', point: 'P3', line: 'S1', t: 0.5 })
    const indexed = rebuildGeometryGraphs(document)
    expect(indexed.dependencies).toContainEqual({ id: 'D1', sourceId: 'P3', dependencyIds: ['S1'], kind: 'pointOnLine' })
  })

  it('renders SVG with embedded geometry metadata', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 20, 30, 'A')
    expect(renderGeometrySvg(document)).toContain('id="whizmd-geometry"')
    expect(renderGeometrySvg(document)).toContain('cx="20"')
    expect(renderGeometrySvg(document)).toContain('>A</text>')
  })

  it('builds circles and text from referenced geometry points', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 100, 100)
    document = addCircle(document, 'P1', 40)
    document = addText(document, 120, 120, 'A')
    const svg = renderGeometrySvg(document)
    expect(svg).toContain('r="40"')
    expect(svg).toContain('>A</text>')
    expect([...document.points, ...document.curves, ...document.annotations].map((object) => object.type)).toEqual(['point', 'circle', 'text'])
  })

  it('calculates midpoint, intersection, and perpendicular foot', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0)
    document = addPoint(document, 10, 0)
    document = addPoint(document, 5, 10)
    document = addSegment(document, 'P1', 'P2')
    document = addSegment(document, 'P3', 'P1')
    document = addPoint(document, 5, 0)
    document = addConstraint(document, { type: 'midpoint', point: 'P4', line: 'S1' })
    expect(resolvePoint(document, 'P4')).toMatchObject({ x: 5, y: 0 })
  })

  it('resizes a circle without allowing a non-positive radius', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 20, 20)
    document = addCircle(document, 'P1', 40)
    expect(getGeometryObject(resizeCircle(document, 'C1', 60), 'C1')).toMatchObject({ type: 'circle', radius: 60 })
    expect(getGeometryObject(resizeCircle(document, 'C1', 0), 'C1')).toMatchObject({ type: 'circle', radius: 1 })
  })

  it('stores constraint definitions in geometry metadata', () => {
    let document = createGeometryDocument()
    document = addConstraint(document, { type: 'parallel', lineA: 'S1', lineB: 'S2' })
    expect(deserializeGeometry(renderGeometrySvg(document).match(/<metadata[^>]*>([\s\S]*?)<\/metadata>/)![1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))?.constraints).toHaveLength(1)
  })

  it('merges connected endpoints into one topology node', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 20, 10); document = addPoint(document, 30, 10)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P3', 'P4')
    const merged = mergePoints(document, 'P1', 'P3')
    expect(merged.topology.nodeIds).toEqual(['P1', 'P2', 'P4'])
    expect(getGeometryObject(merged, 'S2')).toMatchObject({ start: 'P1', end: 'P4' })
    expect(isTopologyNode(merged, 'P1')).toBe(true)
    expect(getNodeIncidents(merged, 'P1')).toEqual([{ curveId: 'S1', endpoint: 'start' }, { curveId: 'S2', endpoint: 'start' }])
  })

  it('does not merge the two endpoints of the same segment', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0)
    document = addSegment(document, 'P1', 'P2')
    expect(mergePoints(document, 'P1', 'P2')).toEqual(document)
    expect(checkMergePoints(document, 'P1', 'P2')).toBe('sameSegment')
  })

  it('merges an intersection point with a coincident segment endpoint', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 0, 0); document = addPoint(document, 0, 10)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P3', 'P4')
    document = addConstraint(document, { type: 'intersection', point: 'P3', lineA: 'S1', lineB: 'S2' })
    const merged = mergePoints(document, 'P1', 'P3')
    expect(getGeometryObject(merged, 'P3')).toBeUndefined()
    expect(merged.segments.every((object) => object.start !== 'P3' && object.end !== 'P3')).toBe(true)
    expect(merged.constraints.some((constraint) => constraint.type === 'intersection' && constraint.point === 'P1')).toBe(true)
  })

  it('merges a previously constructed intersection after its segment endpoints are connected', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 0, 0); document = addPoint(document, 0, 10); document = addPoint(document, 0, 0)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P3', 'P4')
    document = addConstraint(document, { type: 'intersection', point: 'P5', lineA: 'S1', lineB: 'S2' })
    const connected = mergePoints(document, 'P1', 'P3')
    expect(getGeometryObject(connected, 'P5')).toBeUndefined()
    expect(connected.constraints.filter((constraint) => constraint.type === 'intersection' && constraint.point === 'P1')).toHaveLength(1)
    expect(connected.points).toHaveLength(3)
  })

  it('reports a digon rejection reason', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 10, 10)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P2', 'P3')
    expect(checkMergePoints(document, 'P3', 'P1')).toBe('digon')
  })

  it('creates an arc and round-trips it through SVG metadata', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 100, 100)
    document = addArc(document, 'P1', 50, 0, Math.PI / 2)
    const svg = renderGeometrySvg(document)
    expect(svg).toContain('<path')
    expect(deserializeGeometrySvg(svg)).toEqual(document)
    const curve = getGeometryCurves(document).find((item) => item.id === 'A1')
    const projection = curve?.project({ x: 150, y: 100 })
    expect(projection ? projection.distance < 1 : false).toBe(true)
  })

  it('follows an anchored endpoint when it moves', () => {
    let doc2 = createGeometryDocument()
    doc2 = addPoint(doc2, 100, 100); doc2 = addPoint(doc2, 150, 100)
    const curveOf = (doc: ReturnType<typeof createGeometryDocument>, startAngle: number, endAngle: number, anchor?: string) => {
      const arcDoc = addArc(doc, 'P1', 50, startAngle, endAngle, anchor ? { startAnchor: anchor } : undefined)
      return getGeometryCurves(arcDoc).find((item) => item.id === 'A1')
    }
    const staticCurve = curveOf(doc2, 0, Math.PI / 2)
    expect(staticCurve?.project({ x: 150, y: 100 })?.distance).toBeLessThan(0.5)
    doc2 = { ...doc2, points: doc2.points.map((object) => object.id === 'P2' ? { ...object, x: 100, y: 150 } : object) }
    const anchoredCurve = curveOf(doc2, 0, Math.PI / 2, 'P2')
    expect(anchoredCurve?.project({ x: 100, y: 150 })?.distance).toBeLessThan(0.5)
  })

  it('preserves an arc when its center is merged with another point', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0)
    document = addPoint(document, 0, 0)
    document = addPoint(document, 50, 0)
    document = addArc(document, 'P2', 50, 0, Math.PI / 2, { startAnchor: 'P3' })
    const merged = mergePointsTopology(document, 'P1', 'P2')
    expect(getGeometryObject(merged, 'A1')).toMatchObject({ center: 'P1', startAnchor: 'P3' })
    expect(renderGeometrySvg(merged)).toContain('<path')
  })

  it('does not merge a segment endpoint with a point on that segment', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 5, 0)
    document = addSegment(document, 'P1', 'P2')
    expect(mergePoints(document, 'P1', 'P3')).toEqual(document)
  })

  it('does not merge two distinct points on the same segment', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 3, 0); document = addPoint(document, 7, 0)
    document = addSegment(document, 'P1', 'P2')
    expect(mergePoints(document, 'P3', 'P4')).toEqual(document)
  })

  it('does not merge points when it would create a closed two-edge polygon', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 10, 10)
    document = addSegment(document, 'P1', 'P2'); document = addSegment(document, 'P2', 'P3')
    expect(mergePoints(document, 'P3', 'P1')).toEqual(document)
  })

  it('creates a point-on-line without splitting the segment', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0); document = addPoint(document, 10, 0); document = addPoint(document, 5, 0)
    document = addSegment(document, 'P1', 'P2')
    const attached = addConstraint(document, { type: 'pointOnLine', point: 'P3', line: 'S1' })
    expect(attached.segments).toHaveLength(1)
    expect(attached.constraints).toEqual([{ type: 'pointOnLine', point: 'P3', line: 'S1' }])
  })

  it('restores a geometry document from SVG metadata', () => {
    const document = addPoint(createGeometryDocument(), 10, 20, 'A')
    expect(deserializeGeometrySvg(renderGeometrySvg(document))).toEqual(document)
  })

  it('exports an SVG with explicit pixel dimensions', () => {
    const document = createGeometryDocument()
    const svg = renderGeometrySvg(document)
    expect(svg).toContain('width="800"')
    expect(svg).toContain('height="500"')
    expect(svg).toContain('viewBox="0 0 800 500"')
  })

  it('creates and renders an ellipse from two foci', () => {
    let document = addPoint(createGeometryDocument(), 100, 100)
    document = addPoint(document, 200, 100)
    document = addEllipse(document, 'P1', 'P2', 120)
    const ellipse = getGeometryObjects(document, 'ellipse')[0]
    expect(ellipse).toMatchObject({ id: 'E1', focusA: 'P1', focusB: 'P2', semiMajor: 120 })
    if (!ellipse || ellipse.type !== 'ellipse') return
    const geometry = resolveEllipseGeometry(document, ellipse)
    expect(geometry).toMatchObject({ center: { x: 150, y: 100 }, radiusX: 120 })
    expect(geometry?.radiusY).toBeCloseTo(Math.sqrt(120 * 120 - 50 * 50), 6)
    expect(renderGeometrySvg(document)).toContain('<ellipse')
    expect(deserializeGeometrySvg(renderGeometrySvg(document))).toEqual(document)
  })

  it('crops the exported SVG canvas to the content plus proportional padding', () => {
    let document = addPoint(createGeometryDocument(), 100, 100)
    document = addPoint(document, 300, 100)
    document = addSegment(document, 'P1', 'P2')
    const match = renderGeometrySvg(document).match(/viewBox="([^"]+)"/)
    expect(match).not.toBeNull()
    const [viewBoxX, viewBoxY, width, height] = match![1].split(' ').map(Number)
    // 内容 200x8（含点半径与描边外扩）：边白 = min(48, max(12, 208*6%)) = 12
    expect(width).toBe(232)
    expect(height).toBe(32)
    expect(viewBoxX).toBeCloseTo(100 - 12 - 4, 0) // 点圆半径外扩
    expect(viewBoxY).toBeCloseTo(100 - 12 - 4, 0)
    // 元数据往返不受裁剪影响
    expect(deserializeGeometrySvg(renderGeometrySvg(document))).toEqual(document)
  })

  it('rejects executable SVG content', () => {
    expect(sanitizeGeometrySvg('<svg><script>alert(1)</script></svg>')).toBeNull()
    expect(sanitizeGeometrySvg('<svg><circle /></svg>')).toContain('<svg>')
  })

  it('generates non-colliding ids after objects are removed', () => {
    let document = createGeometryDocument()
    document = addPoint(document, 0, 0)
    document = addPoint(document, 10, 0)
    document = addPoint(document, 20, 0)
    const removed = removeObject(document, 'P2')
    const readded = addPoint(removed, 15, 5, 'P2')
    const ids = readded.points.map((object) => object.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(getGeometryObject(readded, 'P4')).toBeDefined()
    const withSegment = addSegment(addSegment(readded, 'P1', 'P2'), 'P3', 'P4')
    const afterSegmentRemoval = { ...withSegment, segments: withSegment.segments.filter((object) => object.id !== 'S1') }
    const newSegment = addSegment(afterSegmentRemoval, 'P2', 'P3')
    const segmentIds = newSegment.segments.map((object) => object.id)
    expect(new Set(segmentIds).size).toBe(segmentIds.length)
  })
})

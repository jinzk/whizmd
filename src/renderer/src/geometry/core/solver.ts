import type { GeometryDocument } from './model'
import { constraintPriority, evaluateConstraints, type ConstraintResult, type GeometryConstraint } from './constraints'
import { getGeometryObject, getGeometryObjects, movePoint } from './model'
import { intersectSegments, resolvePoint } from './calculations'

export type SolveResult = { status: 'solved' | 'partial' | 'conflict' | 'diverged'; document: GeometryDocument; residual: number; iterations: number; violated: ConstraintResult[] }

export function constraintsByPriority(constraints: readonly GeometryConstraint[]): GeometryConstraint[][] {
  const groups = new Map<number, GeometryConstraint[]>()
  for (const constraint of constraints) {
    const priority = constraintPriority(constraint)
    groups.set(priority, [...(groups.get(priority) ?? []), constraint])
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group)
}

type Variable = { id: string; axis: 'x' | 'y' }

type Point = { x: number; y: number }

function segmentPoints(document: GeometryDocument, id: string): { startId: string; endId: string; start: Point; end: Point } | null {
  const object = getGeometryObject(document, id)
  if (!object || object.type !== 'segment') return null
  const start = getGeometryObject(document, object.start)
  const end = getGeometryObject(document, object.end)
  return start && end && start.type === 'point' && end.type === 'point' ? { startId: start.id, endId: end.id, start, end } : null
}

function solveDeterministicConstraint(document: GeometryDocument, constraint: GeometryConstraint, lockedPointId?: string): GeometryDocument {
  if (constraint.type === 'coincident') {
    const first = getGeometryObject(document, constraint.pointA)
    const second = getGeometryObject(document, constraint.pointB)
    if (!first || !second || first.type !== 'point' || second.type !== 'point') return document
    if (lockedPointId === second.id) return movePoint(document, first.id, second.x, second.y)
    return movePoint(document, second.id, first.x, first.y)
  }
  if (constraint.type === 'pointOnLine') {
    const segment = segmentPoints(document, constraint.line)
    const attached = getGeometryObject(document, constraint.point)
    if (!segment || !attached || attached.type !== 'point') return document
    const dx = segment.end.x - segment.start.x; const dy = segment.end.y - segment.start.y
    const lengthSquared = dx * dx + dy * dy
    if (!lengthSquared) return document
    const rawT = ((attached.x - segment.start.x) * dx + (attached.y - segment.start.y) * dy) / lengthSquared
    if (lockedPointId === attached.id) {
      const t = Math.max(0, Math.min(1, rawT))
      const moved = movePoint(document, attached.id, segment.start.x + t * dx, segment.start.y + t * dy)
      return constraint.t !== undefined && Math.abs(constraint.t - t) <= 1e-9 ? moved : updatePointOnLineT(moved, constraint, t)
    }
    const t = Math.max(0, Math.min(1, constraint.t ?? rawT))
    const moved = movePoint(document, attached.id, segment.start.x + t * dx, segment.start.y + t * dy)
    return constraint.t === undefined ? updatePointOnLineT(moved, constraint, t) : moved
  }
  if (constraint.type === 'midpoint') {
    const segment = segmentPoints(document, constraint.line)
    if (!segment) return document
    return movePoint(document, constraint.point, (segment.start.x + segment.end.x) / 2, (segment.start.y + segment.end.y) / 2)
  }
  if (constraint.type === 'intersection') {
    if (lockedPointId === constraint.point) return document
    const first = getGeometryObject(document, constraint.lineA)
    const second = getGeometryObject(document, constraint.lineB)
    if (!first || !second || first.type !== 'segment' || second.type !== 'segment') return document
    const point = intersectSegments(document, first, second)
    return point ? movePoint(document, constraint.point, point.x, point.y) : document
  }
  if (constraint.type === 'horizontal' || constraint.type === 'vertical') {
    const segment = segmentPoints(document, constraint.segment)
    if (!segment) return document
    const originalLength = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y)
    if (constraint.type === 'horizontal') {
      return lockedPointId === segment.endId
        ? movePoint(document, segment.startId, segment.end.x - Math.sign(segment.end.x - segment.start.x || 1) * originalLength, segment.end.y)
        : movePoint(document, segment.endId, segment.start.x + Math.sign(segment.end.x - segment.start.x || 1) * originalLength, segment.start.y)
    }
    return lockedPointId === segment.endId
      ? movePoint(document, segment.startId, segment.end.x, segment.end.y - Math.sign(segment.end.y - segment.start.y || 1) * originalLength)
      : movePoint(document, segment.endId, segment.start.x, segment.start.y + Math.sign(segment.end.y - segment.start.y || 1) * originalLength)
  }
  if (constraint.type === 'fixedDistance') {
    const first = getGeometryObject(document, constraint.a)
    const second = getGeometryObject(document, constraint.b)
    if (!first || !second || first.type !== 'point' || second.type !== 'point') return document
    const dx = second.x - first.x; const dy = second.y - first.y
    const size = Math.hypot(dx, dy)
    const ux = size ? dx / size : 1; const uy = size ? dy / size : 0
    if (lockedPointId === second.id) return movePoint(document, first.id, second.x - ux * constraint.value, second.y - uy * constraint.value)
    return movePoint(document, second.id, first.x + ux * constraint.value, first.y + uy * constraint.value)
  }
  if (constraint.type === 'tangent') {
    const circleObject = getGeometryObject(document, constraint.curveA) ?? getGeometryObject(document, constraint.curveB)
    const otherId = circleObject ? (circleObject.id === constraint.curveA ? constraint.curveB : constraint.curveA) : null
    const lineObject = otherId ? getGeometryObject(document, otherId) : null
    if (circleObject && lineObject && (circleObject.type === 'circle' || circleObject.type === 'arc')) {
      const center = resolvePoint(document, circleObject.center)
      const linePoints = segmentPoints(document, lineObject.id)
      if (!center || !linePoints) return document
      const vx = linePoints.end.x - linePoints.start.x; const vy = linePoints.end.y - linePoints.start.y
      const length = Math.hypot(vx, vy)
      if (!length) return document
      const ux = vx / length; const uy = vy / length
      const cross = (center.x - linePoints.start.x) * uy - (center.y - linePoints.start.y) * ux
      const target = (cross >= 0 ? 1 : -1) * circleObject.radius
      const shift = cross - target
      const offsetX = shift * uy; const offsetY = -shift * ux
      const movedStart = movePoint(document, linePoints.startId, linePoints.start.x + offsetX, linePoints.start.y + offsetY)
      return movePoint(movedStart, linePoints.endId, linePoints.end.x + offsetX, linePoints.end.y + offsetY)
    }
    const firstCircle = getGeometryObject(document, constraint.curveA)
    const secondCircle = getGeometryObject(document, constraint.curveB)
    if (firstCircle && secondCircle && (firstCircle.type === 'circle' || firstCircle.type === 'arc') && (secondCircle.type === 'circle' || secondCircle.type === 'arc')) {
      const firstCenter = resolvePoint(document, firstCircle.center)
      const secondCenter = resolvePoint(document, secondCircle.center)
      if (!firstCenter || !secondCenter) return document
      const dx = secondCenter.x - firstCenter.x; const dy = secondCenter.y - firstCenter.y
      const distance = Math.hypot(dx, dy)
      if (!distance) return document
      const external = firstCircle.radius + secondCircle.radius
      const internal = Math.abs(firstCircle.radius - secondCircle.radius)
      const currentExternalError = Math.abs(distance - external)
      const targetLength = currentExternalError <= internal ? external : internal
      const scale = targetLength / distance
      return movePoint(document, secondCircle.center, firstCenter.x + dx * scale, firstCenter.y + dy * scale)
    }
    return document
  }
  if (constraint.type === 'fixedAngle') {
    const vertexPoint = getGeometryObject(document, constraint.vertex)
    const armA = getGeometryObject(document, constraint.a)
    const armB = getGeometryObject(document, constraint.b)
    if (!vertexPoint || !armA || !armB || vertexPoint.type !== 'point' || armA.type !== 'point' || armB.type !== 'point') return document
    const vertex = { x: vertexPoint.x, y: vertexPoint.y }
    const requested = Math.abs(constraint.value)
    const signedCurrent = (): number => {
      const value = Math.atan2(armB.y - vertex.y, armB.x - vertex.x) - Math.atan2(armA.y - vertex.y, armA.x - vertex.x)
      return Math.atan2(Math.sin(value), Math.cos(value))
    }
    const signedTarget = (): number => (signedCurrent() < 0 ? -requested : requested)
    if (lockedPointId === constraint.a && lockedPointId !== constraint.b) {
      const radiusA = Math.hypot(armA.x - vertex.x, armA.y - vertex.y)
      const angleB = Math.atan2(armB.y - vertex.y, armB.x - vertex.x)
      const target = angleB - signedTarget()
      return movePoint(document, constraint.a, vertex.x + Math.cos(target) * radiusA, vertex.y + Math.sin(target) * radiusA)
    }
    const radiusB = Math.hypot(armB.x - vertex.x, armB.y - vertex.y)
    const angleA = Math.atan2(armA.y - vertex.y, armA.x - vertex.x)
    const target = angleA + signedTarget()
    return movePoint(document, constraint.b, vertex.x + Math.cos(target) * radiusB, vertex.y + Math.sin(target) * radiusB)
  }
  if (constraint.type === 'symmetric') {
    const first = getGeometryObject(document, constraint.a)
    const second = getGeometryObject(document, constraint.b)
    const mirror = segmentPoints(document, constraint.mirror)
    if (!first || !second || !mirror || first.type !== 'point' || second.type !== 'point') return document
    const vx = mirror.end.x - mirror.start.x; const vy = mirror.end.y - mirror.start.y
    const lengthSquared = Math.max(1e-12, vx * vx + vy * vy)
    const reflect = (point: { x: number; y: number }): { x: number; y: number } => {
      const dx = point.x - mirror.start.x; const dy = point.y - mirror.start.y
      const along = (dx * vx + dy * vy) / lengthSquared
      const footX = mirror.start.x + along * vx; const footY = mirror.start.y + along * vy
      return { x: 2 * footX - point.x, y: 2 * footY - point.y }
    }
    if (lockedPointId === second.id) {
      const mirrored = reflect(second)
      return movePoint(document, first.id, mirrored.x, mirrored.y)
    }
    const mirrored = reflect(first)
    return movePoint(document, second.id, mirrored.x, mirrored.y)
  }
  if (constraint.type === 'equalLength') {
    const reference = segmentPoints(document, constraint.segmentA)
    const adjusted = segmentPoints(document, constraint.segmentB)
    if (!reference || !adjusted) return document
    const referenceLength = Math.hypot(reference.end.x - reference.start.x, reference.end.y - reference.start.y)
    if (!referenceLength) return document
    const endShared = reference.startId === adjusted.endId || reference.endId === adjusted.endId
    let moveEnd: boolean
    if (lockedPointId === adjusted.startId) moveEnd = true
    else if (lockedPointId === adjusted.endId) moveEnd = false
    else moveEnd = !endShared
    const pivot = moveEnd ? adjusted.start : adjusted.end
    const free = moveEnd ? adjusted.end : adjusted.start
    const vx = free.x - pivot.x
    const vy = free.y - pivot.y
    const length = Math.hypot(vx, vy)
    if (!length) return document
    const scale = referenceLength / length
    return movePoint(document, moveEnd ? adjusted.endId : adjusted.startId, pivot.x + vx * scale, pivot.y + vy * scale)
  }
  if (constraint.type !== 'parallel' && constraint.type !== 'perpendicular') return document
  let reference = segmentPoints(document, constraint.lineA)
  let adjusted = segmentPoints(document, constraint.lineB)
  if (!reference || !adjusted) return document
  // 拖拽被调整线段端点时动态互换角色：被拖线段刚性跟随光标（长度不变），伙伴绕枢轴同步旋转。
  const draggingAdjusted = lockedPointId === adjusted.startId || lockedPointId === adjusted.endId
  if (draggingAdjusted) [reference, adjusted] = [adjusted, reference]
  const referenceVector = { x: reference.end.x - reference.start.x, y: reference.end.y - reference.start.y }
  const referenceSize = Math.hypot(referenceVector.x, referenceVector.y)
  if (!referenceSize) return document
  let ux = referenceVector.x / referenceSize; let uy = referenceVector.y / referenceSize
  if (constraint.type === 'perpendicular') { const tx = ux; ux = -uy; uy = tx }
  const adjustedVector = { x: adjusted.end.x - adjusted.start.x, y: adjusted.end.y - adjusted.start.y }
  const targetLength = Math.hypot(adjustedVector.x, adjustedVector.y)
  if (!targetLength) return document
  // 平行不区分方向：按点积符号对齐，保持被调整线段原有朝向（反向平行不被翻转）。
  if (adjustedVector.x * ux + adjustedVector.y * uy < 0) { ux = -ux; uy = -uy }
  const lockedOnStart = lockedPointId === adjusted.startId
  const lockedOnEnd = lockedPointId === adjusted.endId
  const startSharedWithReference = reference.startId === adjusted.startId || reference.endId === adjusted.startId
  const endSharedWithReference = reference.startId === adjusted.endId || reference.endId === adjusted.endId
  let moveTo: 'start' | 'end'
  if (lockedOnEnd && !startSharedWithReference) moveTo = 'start'
  else if (lockedOnStart && !endSharedWithReference) moveTo = 'end'
  else moveTo = endSharedWithReference ? 'start' : 'end'
  if (moveTo === 'start') return movePoint(document, adjusted.startId, adjusted.end.x - ux * targetLength, adjusted.end.y - uy * targetLength)
  return movePoint(document, adjusted.endId, adjusted.start.x + ux * targetLength, adjusted.start.y + uy * targetLength)
}

function updatePointOnLineT(document: GeometryDocument, constraint: GeometryConstraint & { type: 'pointOnLine' }, t: number): GeometryDocument {
  return { ...document, constraints: document.constraints.map((item) => item === constraint ? { ...item, t } : item) }
}

function variables(document: GeometryDocument, lockedPointId?: string, allowedIds?: Set<string>): Variable[] {
  return getGeometryObjects(document, 'point')
    .filter((object) => object.id !== lockedPointId && (!allowedIds || allowedIds.has(object.id)))
    .flatMap((point) => [{ id: point.id, axis: 'x' as const }, { id: point.id, axis: 'y' as const }])
}

function involvedPointIds(document: GeometryDocument, constraints: GeometryConstraint[]): Set<string> {
  const byId = new Map([...document.points, ...document.segments, ...document.curves, ...document.annotations].map((object) => [object.id, object]))
  const ids = new Set<string>()
  const visit = (value: unknown): void => {
    if (typeof value !== 'string' || ids.has(value)) return
    const object = byId.get(value)
    if (!object) return
    if (object.type === 'point') {
      ids.add(object.id)
      return
    }
    if (object.type === 'segment') {
      ids.add(object.start)
      ids.add(object.end)
      return
    }
    if (object.type === 'circle' || object.type === 'arc') {
      visit(object.center)
      return
    }
  }
  for (const constraint of constraints) Object.values(constraint).forEach(visit)
  return ids
}

function residual(document: GeometryDocument, constraints: GeometryConstraint[]): number[] {
  return constraints.map((constraint) => evaluateConstraintResidual(document, constraint))
}

function evaluateConstraintResidual(document: GeometryDocument, constraint: GeometryConstraint): number {
  const result = evaluateConstraints(document, [constraint])[0]
  if (!result || !Number.isFinite(result.error)) return 1000
  if (constraint.type === 'fixedDistance' || constraint.type === 'equalLength') return result.error
  return Math.sqrt(result.error)
}

function updateVariable(document: GeometryDocument, variable: Variable, delta: number): GeometryDocument {
  const point = getGeometryObject(document, variable.id)
  if (!point || point.type !== 'point') return document
  return movePoint(document, point.id, variable.axis === 'x' ? point.x + delta : point.x, variable.axis === 'y' ? point.y + delta : point.y)
}

function solveLinearSystem(matrix: number[][], values: number[]): number[] | null {
  const n = values.length
  const augmented = matrix.map((row, index) => [...row, values[index]])
  for (let column = 0; column < n; column += 1) {
    let pivot = column
    for (let row = column + 1; row < n; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row
    if (Math.abs(augmented[pivot][column]) < 1e-10) return null
    ;[augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]]
    for (let row = column + 1; row < n; row += 1) {
      const factor = augmented[row][column] / augmented[column][column]
      for (let c = column; c <= n; c += 1) augmented[row][c] -= factor * augmented[column][c]
    }
  }
  const result = Array(n).fill(0)
  for (let row = n - 1; row >= 0; row -= 1) result[row] = (augmented[row][n] - augmented[row].slice(row + 1, n).reduce((sum, value, index) => sum + value * result[row + 1 + index], 0)) / augmented[row][row]
  return result
}

export function solveGeometry(document: GeometryDocument, constraints: GeometryConstraint[] = document.constraints, maxIterations = 12, lockedPointId?: string): SolveResult {
  let current = document
  let iteration = 0
  for (const priorityGroup of constraintsByPriority(constraints)) {
    for (let groupIteration = 0; groupIteration < maxIterations; groupIteration += 1) {
      iteration += 1
      const results = evaluateConstraints(current, priorityGroup)
      const violated = results.filter((result) => !result.valid)
      if (!violated.length) break
      const violatedConstraints = priorityGroup.filter((_constraint, index) => !results[index].valid)
      const deterministic = violatedConstraints.reduce((next, constraint) => solveDeterministicConstraint(next, constraint, lockedPointId), current)
      if (JSON.stringify(deterministic) !== JSON.stringify(current)) {
        current = deterministic
        continue
      }
      break
    }
  }
  for (iteration = 0; iteration < maxIterations; iteration += 1) {
    const results = evaluateConstraints(current, constraints)
    const violated = results.filter((result) => !result.valid)
    if (!violated.length) return { status: 'solved', document: current, residual: 0, iterations: iteration, violated: [] }
    // 只投影当前被违反的约束：已满足的约束（可能属于其他图形）不得产生任何位移。
    const violatedConstraints = constraints.filter((_constraint, index) => !results[index].valid).sort((a, b) => constraintPriority(a) - constraintPriority(b))
    const deterministic = violatedConstraints.reduce((next, constraint) => solveDeterministicConstraint(next, constraint, lockedPointId), current)
    if (JSON.stringify(deterministic) !== JSON.stringify(current)) {
      current = deterministic
      continue
    }
    const before = current
    const free = variables(current, lockedPointId, involvedPointIds(current, violatedConstraints))
    const base = residual(current, violatedConstraints)
    const jacobian = base.map((_value, row) => free.map((variable) => {
      const perturbed = updateVariable(current, variable, 0.01)
      return (residual(perturbed, violatedConstraints)[row] - base[row]) / 0.01
    }))
    const normal = free.map((_variable, column) => free.map((_other, row) => jacobian.reduce((sum, values) => sum + values[column] * values[row], 0) + (column === row ? 0.001 : 0)))
    const gradient = free.map((_variable, column) => -jacobian.reduce((sum, values, index) => sum + values[column] * base[index], 0))
    const delta = solveLinearSystem(normal, gradient)
    if (delta) free.forEach((variable, index) => { current = updateVariable(current, variable, Math.max(-20, Math.min(20, delta[index]))) })
    if (JSON.stringify(before) === JSON.stringify(current)) return { status: 'diverged', document: current, residual: violated.reduce((sum, result) => sum + result.error, 0), iterations: iteration + 1, violated }
  }
  const results = evaluateConstraints(current, constraints); const violated = results.filter((result) => !result.valid)
  return { status: violated.length ? 'partial' : 'solved', document: current, residual: violated.reduce((sum, result) => sum + result.error, 0), iterations: maxIterations, violated }
}

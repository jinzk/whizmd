import { describe, expect, it } from 'vitest'
import { GEOMETRY_TOOLS, acceptsTarget, isInteractiveCanvasTool } from '../core/tools'

describe('geometry tool registry', () => {
  it('defines a profile for every tool id', () => {
    expect(Object.keys(GEOMETRY_TOOLS)).toHaveLength(22)
    for (const profile of Object.values(GEOMETRY_TOOLS)) {
      expect(profile.selects.length).toBeGreaterThan(0)
      expect(profile.selects.every((slot) => slot.length > 0)).toBe(true)
    }
  })

  it('marks drawing tools as non-interactive and constraint tools as interactive', () => {
    expect(isInteractiveCanvasTool('point')).toBe(false)
    expect(isInteractiveCanvasTool('segment')).toBe(false)
    expect(isInteractiveCanvasTool('polygon')).toBe(false)
    expect(isInteractiveCanvasTool('text')).toBe(false)
    expect(isInteractiveCanvasTool('arc')).toBe(false)
    expect(isInteractiveCanvasTool('parallel')).toBe(true)
    expect(isInteractiveCanvasTool('tangent')).toBe(true)
    expect(isInteractiveCanvasTool('symmetric')).toBe(true)
    expect(isInteractiveCanvasTool('horizontal')).toBe(true)
  })

  it('enforces ordered selection slots', () => {
    const tangent = GEOMETRY_TOOLS.tangent
    expect(acceptsTarget(tangent, 0, 'circle')).toBe(true)
    expect(acceptsTarget(tangent, 0, 'arc')).toBe(true)
    expect(acceptsTarget(tangent, 0, 'segment')).toBe(true)
    expect(acceptsTarget(tangent, 0, 'point')).toBe(false)
    expect(acceptsTarget(tangent, 1, 'segment')).toBe(true)
    expect(acceptsTarget(tangent, 2, 'segment')).toBe(false)

    const symmetric = GEOMETRY_TOOLS.symmetric
    expect(symmetric.selects).toEqual([['point'], ['point'], ['segment']])
    expect(acceptsTarget(symmetric, 0, 'point')).toBe(true)
    expect(acceptsTarget(symmetric, 0, 'segment')).toBe(false)
    expect(acceptsTarget(symmetric, 2, 'segment')).toBe(true)
  })

  it('flags which tools solve on creation', () => {
    expect(GEOMETRY_TOOLS.parallel.solveOnCreate).toBe(true)
    expect(GEOMETRY_TOOLS.tangent.solveOnCreate).toBe(true)
    expect(GEOMETRY_TOOLS.symmetric.solveOnCreate).toBe(true)
    expect(GEOMETRY_TOOLS.coincident.solveOnCreate).toBe(false)
    expect(GEOMETRY_TOOLS.intersection.solveOnCreate).toBe(false)
    expect(GEOMETRY_TOOLS.rotate.solveOnCreate).toBe(false)
  })
})

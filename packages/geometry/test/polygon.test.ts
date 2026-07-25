import { describe, expect, it } from 'vitest'
import {
  area,
  contains,
  distToBoundary,
  distToSegment,
  signedArea,
  strictlyInside,
  unionContains,
  unionContainsSegment,
} from '../src/polygon'
import { vec } from '../src/vec'

const unitSquare = [vec(0, 0), vec(1, 0), vec(1, 1), vec(0, 1)]
const triangle = [vec(0, 0), vec(2, 0), vec(1, 1)]

describe('area', () => {
  it('computes signed area with orientation', () => {
    expect(signedArea(unitSquare)).toBe(1)
    expect(signedArea([...unitSquare].reverse())).toBe(-1)
    expect(area([...unitSquare].reverse())).toBe(1)
    expect(area(triangle)).toBe(1)
  })

  it('handles thin slivers without losing precision', () => {
    const sliver = [vec(0, 0), vec(1e-6, 0), vec(0.5e-6, 1)]
    expect(area(sliver)).toBeCloseTo(0.5e-6, 12)
  })
})

describe('strictlyInside', () => {
  it('classifies interior and exterior points', () => {
    expect(strictlyInside(unitSquare, vec(0.5, 0.5))).toBe(true)
    expect(strictlyInside(unitSquare, vec(1.5, 0.5))).toBe(false)
    expect(strictlyInside(unitSquare, vec(-0.001, 0.5))).toBe(false)
    expect(strictlyInside(triangle, vec(1, 0.5))).toBe(true)
    expect(strictlyInside(triangle, vec(1, 1.001))).toBe(false)
  })

  it('classifies points just inside sharp corners', () => {
    expect(strictlyInside(triangle, vec(1, 0.999))).toBe(true)
    expect(strictlyInside(triangle, vec(0.01, 0.001))).toBe(true)
  })
})

describe('distToSegment', () => {
  it('measures perpendicular distance in the segment span', () => {
    expect(distToSegment(vec(0.5, 1), vec(0, 0), vec(1, 0))).toBe(1)
  })

  it('measures distance to endpoints outside the span', () => {
    expect(distToSegment(vec(-3, 4), vec(0, 0), vec(1, 0))).toBe(5)
    expect(distToSegment(vec(4, 4), vec(0, 0), vec(1, 0))).toBe(5)
  })

  it('handles degenerate zero-length segments', () => {
    expect(distToSegment(vec(3, 4), vec(0, 0), vec(0, 0))).toBe(5)
  })
})

describe('contains with tolerance', () => {
  it('accepts boundary points and vertices', () => {
    expect(contains(unitSquare, vec(0, 0.5), 1e-9)).toBe(true)
    expect(contains(unitSquare, vec(0, 0), 1e-9)).toBe(true)
    expect(contains(unitSquare, vec(1, 1), 1e-9)).toBe(true)
  })

  it('accepts points within tol of the boundary and rejects beyond', () => {
    expect(contains(unitSquare, vec(-1e-4, 0.5), 1e-3)).toBe(true)
    expect(contains(unitSquare, vec(-2e-3, 0.5), 1e-3)).toBe(false)
  })

  it('measures boundary distance from inside and outside', () => {
    expect(distToBoundary(vec(0.5, 0.5), unitSquare)).toBe(0.5)
    expect(distToBoundary(vec(2, 0.5), unitSquare)).toBe(1)
  })
})

describe('union containment', () => {
  const left = [vec(0, 0), vec(1.01, 0), vec(1.01, 1), vec(0, 1)]
  const right = [vec(1, 0), vec(2, 0), vec(2, 1), vec(1, 1)]

  it('accepts points in either polygon', () => {
    expect(unionContains([left, right], vec(0.5, 0.5), 1e-9)).toBe(true)
    expect(unionContains([left, right], vec(1.5, 0.5), 1e-9)).toBe(true)
    expect(unionContains([left, right], vec(2.5, 0.5), 1e-9)).toBe(false)
  })

  it('accepts a segment crossing an overlapped seam', () => {
    expect(unionContainsSegment([left, right], vec(0.1, 0.5), vec(1.9, 0.5), 1e-9, 0.01)).toBe(true)
  })

  it('rejects a segment crossing a genuine gap', () => {
    const gapped = [vec(1.2, 0), vec(2, 0), vec(2, 1), vec(1.2, 1)]
    expect(unionContainsSegment([left, gapped], vec(0.1, 0.5), vec(1.9, 0.5), 1e-4, 0.01)).toBe(
      false,
    )
  })

  it('rejects when the segment pokes past the far edge', () => {
    expect(unionContainsSegment([left, right], vec(0.5, 0.5), vec(2.1, 0.5), 1e-4, 0.01)).toBe(
      false,
    )
  })
})

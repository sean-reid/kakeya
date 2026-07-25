import { describe, expect, it } from 'vitest'
import { deltoidPolygon, UNIT_NEEDLE_R } from '../src/deltoid'
import { boundingBox, gridUnionArea } from '../src/union'
import { vec } from '../src/vec'

const square = (x: number, y: number, s: number) => [
  vec(x, y),
  vec(x + s, y),
  vec(x + s, y + s),
  vec(x, y + s),
]

describe('boundingBox', () => {
  it('wraps all vertices of all polygons', () => {
    const box = boundingBox([square(0, 0, 1), square(2, -1, 0.5)])
    expect(box).toEqual({ minX: 0, minY: -1, maxX: 2.5, maxY: 1 })
  })
})

describe('gridUnionArea', () => {
  it('measures a single square', () => {
    expect(gridUnionArea([square(0, 0, 1)], 0.005)).toBeCloseTo(1, 2)
  })

  it('does not double-count overlap', () => {
    const a = square(0, 0, 1)
    const b = square(0.5, 0, 1)
    expect(gridUnionArea([a, b], 0.005)).toBeCloseTo(1.5, 2)
  })

  it('sums disjoint pieces', () => {
    const a = square(0, 0, 1)
    const b = square(3, 3, 2)
    expect(gridUnionArea([a, b], 0.01)).toBeCloseTo(5, 1)
  })

  it('agrees with the closed form for the deltoid', () => {
    const poly = deltoidPolygon(UNIT_NEEDLE_R, 2048)
    expect(gridUnionArea([poly], 0.002)).toBeCloseTo(Math.PI / 8, 2)
  })

  it('converges as the grid refines', () => {
    const polys = [square(0, 0, 1), square(0.25, 0.25, 1)]
    const coarse = Math.abs(gridUnionArea(polys, 0.05) - 1.4375)
    const fine = Math.abs(gridUnionArea(polys, 0.005) - 1.4375)
    expect(fine).toBeLessThanOrEqual(coarse)
    expect(fine).toBeLessThan(0.01)
  })

  it('returns zero for no polygons', () => {
    expect(gridUnionArea([], 0.01)).toBe(0)
  })
})

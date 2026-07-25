import { describe, expect, it } from 'vitest'
import {
  equilateralFan,
  perronAreaUpperBound,
  perronOffsets,
  perronTree,
  type PerronOptions,
} from '../src/perron'
import { area } from '../src/polygon'
import { gridUnionArea } from '../src/union'
import { vec } from '../src/vec'

const apex = vec(0, 1)
const triangleArea = (a: number, c: number) => ((c - a) * apex.y) / 2

describe('perronOffsets', () => {
  it('reproduces the elementary step at depth 1', () => {
    const offsets = perronOffsets(0, 1, { depth: 1, alpha: 0.75 })
    expect(offsets).toEqual([0, -(1 - 0.75) * 1])
  })

  it('keeps every slice within one base length of home', () => {
    for (const depth of [2, 4, 6, 8]) {
      const offsets = perronOffsets(0, 1, { depth, alpha: 0.7 })
      expect(offsets).toHaveLength(2 ** depth)
      for (const e of offsets) expect(Math.abs(e)).toBeLessThan(1)
    }
  })

  it('moves nothing as alpha approaches 1', () => {
    const offsets = perronOffsets(0, 1, { depth: 3, alpha: 0.999 })
    for (const e of offsets) expect(Math.abs(e)).toBeLessThan(0.01)
  })

  it('rejects alpha outside (1/2, 1) and fractional depth', () => {
    expect(() => perronOffsets(0, 1, { depth: 2, alpha: 0.5 })).toThrow()
    expect(() => perronOffsets(0, 1, { depth: 2, alpha: 1 })).toThrow()
    expect(() => perronOffsets(0, 1, { depth: 1.5, alpha: 0.75 })).toThrow()
  })
})

describe('perronTree slices', () => {
  const opts: PerronOptions = { depth: 3, alpha: 0.75 }
  const slices = perronTree(apex, -0.5, 0.5, opts)

  it('produces exact translates of the original slices', () => {
    const w = 1 / 2 ** opts.depth
    for (const s of slices) {
      expect(area(s.polygon)).toBeCloseTo((w * apex.y) / 2, 12)
      const [b0, b1, top] = s.polygon
      expect(b1!.x - b0!.x).toBeCloseTo(w, 12)
      expect(top!.y).toBe(apex.y)
      expect(b0!.y).toBe(0)
    }
  })

  it('tiles the direction range exactly, no gaps and no overlaps', () => {
    for (let i = 1; i < slices.length; i++) {
      expect(slices[i]!.thetaIn).toBe(slices[i - 1]!.thetaOut)
    }
    for (const s of slices) {
      expect(s.thetaOut).toBeGreaterThan(s.thetaIn)
    }
  })

  it('pivots sit at height 1 so the unit needle fits', () => {
    for (const s of slices) expect(s.apex.y).toBe(1)
  })

  it('rejects apexes below unit height', () => {
    expect(() => perronTree(vec(0, 0.9), -0.5, 0.5, opts)).toThrow()
  })
})

describe('perron areas', () => {
  it('matches the exact elementary-step identity at depth 1', () => {
    for (const alpha of [0.6, 0.75, 0.9]) {
      const slices = perronTree(apex, -0.5, 0.5, { depth: 1, alpha })
      const measured = gridUnionArea(
        slices.map((s) => s.polygon),
        0.002,
      )
      const predicted = (3 * alpha * alpha - 4 * alpha + 2) * triangleArea(-0.5, 0.5)
      expect(measured).toBeCloseTo(predicted, 2)
    }
  })

  it('respects the closed-form upper bound at every depth', () => {
    for (const depth of [2, 3, 4, 5]) {
      const opts = { depth, alpha: 0.75 }
      const slices = perronTree(apex, -0.5, 0.5, opts)
      const measured = gridUnionArea(
        slices.map((s) => s.polygon),
        0.002,
      )
      const bound = perronAreaUpperBound(opts) * triangleArea(-0.5, 0.5)
      expect(measured).toBeLessThanOrEqual(bound + 0.01)
    }
  })

  it('shrinks as depth grows', () => {
    const measure = (depth: number) =>
      gridUnionArea(
        perronTree(apex, -0.5, 0.5, { depth, alpha: 0.72 }).map((s) => s.polygon),
        0.002,
      )
    const a2 = measure(2)
    const a4 = measure(4)
    const a6 = measure(6)
    expect(a4).toBeLessThan(a2)
    expect(a6).toBeLessThan(a4)
  })
})

describe('equilateralFan', () => {
  const slices = equilateralFan({ depth: 3, alpha: 0.75 })

  it('spans exactly sixty degrees of directions', () => {
    const first = slices[0]!.thetaIn
    const last = slices[slices.length - 1]!.thetaOut
    expect(last - first).toBeCloseTo(Math.PI / 3, 12)
    expect(first).toBeCloseTo((-2 * Math.PI) / 3, 12)
  })
})

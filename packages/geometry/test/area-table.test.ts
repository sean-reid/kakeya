import { describe, expect, it } from 'vitest'
import { AREA_TABLE } from '../src/area-table'
import { deltoidArea, UNIT_NEEDLE_R } from '../src/deltoid'
import { equilateralFan } from '../src/perron'
import { kakeyaSweep } from '../src/sweep'
import { gridUnionArea } from '../src/union'

describe('the generated area table', () => {
  it('covers depths one through nine', () => {
    expect(AREA_TABLE.map((r) => r.depth)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('matches fresh measurements at the shallow depths', () => {
    for (const row of AREA_TABLE.filter((r) => r.depth <= 3)) {
      const polys = equilateralFan({ depth: row.depth, alpha: row.alpha }).map((s) => s.polygon)
      expect(gridUnionArea(polys, 0.002)).toBeCloseTo(row.fanArea, 1)
    }
  }, 60_000)

  it('matches fresh join budgets exactly - they are deterministic', () => {
    for (const row of AREA_TABLE.filter((r) => r.depth <= 4)) {
      const sweep = kakeyaSweep({ depth: row.depth, alpha: row.alpha, joinExcursion: 100 })
      expect(sweep.joinArea).toBeCloseTo(row.joinArea, 6)
    }
  })

  it('areas fall as depth grows, with no floor in sight', () => {
    for (let i = 1; i < AREA_TABLE.length; i++) {
      expect(AREA_TABLE[i]!.fanArea).toBeLessThan(AREA_TABLE[i - 1]!.fanArea)
      expect(AREA_TABLE[i]!.sweepArea).toBeLessThan(AREA_TABLE[i - 1]!.sweepArea)
    }
  })

  it('every configuration beats the half disc, and depth nine beats the deltoid', () => {
    const halfDisc = Math.PI / 2
    for (const row of AREA_TABLE) {
      expect(row.sweepArea + row.joinArea).toBeLessThan(halfDisc)
    }
    const deepest = AREA_TABLE[AREA_TABLE.length - 1]!
    expect(deepest.sweepArea + deepest.joinArea).toBeLessThan(deltoidArea(UNIT_NEEDLE_R))
  })
})

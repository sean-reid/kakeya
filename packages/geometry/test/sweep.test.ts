import { describe, expect, it } from 'vitest'
import { segmentStrip } from '../src/join'
import { compile, evaluate, needleB } from '../src/motion'
import { unionContainsSegment, type Polygon } from '../src/polygon'
import { kakeyaSweep, sweepEnd, sweepPaths, sweepPolygons } from '../src/sweep'
import { dist } from '../src/vec'

const opts = { depth: 2, alpha: 0.75, joinExcursion: 12 }

describe('kakeyaSweep structure', () => {
  const sweep = kakeyaSweep(opts)

  it('carries three fans of slices and a join between every consecutive pair', () => {
    expect(sweep.slices).toHaveLength(3 * 2 ** opts.depth)
    expect(sweep.joins).toHaveLength(sweep.slices.length - 1)
  })

  it('turns through exactly half a turn overall', () => {
    const end = sweepEnd(sweep)
    expect(end.theta - sweep.start.theta).toBeCloseTo(Math.PI, 12)
  })

  it('tiles the direction range with no gap at fan boundaries', () => {
    for (let i = 1; i < sweep.slices.length; i++) {
      expect(sweep.slices[i]!.thetaIn).toBeCloseTo(sweep.slices[i - 1]!.thetaOut, 12)
    }
  })

  it('drives the join budget as low as asked by lengthening the excursion', () => {
    expect(sweep.joinArea).toBeGreaterThan(0)
    const far = kakeyaSweep({ ...opts, joinExcursion: 100 })
    expect(far.joinArea).toBeLessThan(0.03)
    const veryFar = kakeyaSweep({ ...opts, joinExcursion: 1000 })
    expect(veryFar.joinArea).toBeLessThan(0.003)
  })

  it('halves the join budget when the excursion doubles', () => {
    const far = kakeyaSweep({ ...opts, joinExcursion: 24 })
    expect(far.joinArea).toBeLessThan(sweep.joinArea * 0.6)
  })

  it('segments cover every move exactly once, in order', () => {
    let cursor = 0
    for (const seg of sweep.segments) {
      expect(seg.moveStart).toBe(cursor)
      expect(seg.moveEnd).toBeGreaterThan(seg.moveStart)
      cursor = seg.moveEnd
    }
    expect(cursor).toBe(sweep.moves.length)
  })
})

describe('kakeyaSweep containment - the needle never leaves the set', () => {
  it('holds at every sampled instant of the whole program', () => {
    const tol = 2e-3
    const sweep = kakeyaSweep(opts)
    const region: Polygon[] = [
      ...sweepPolygons(sweep),
      ...sweepPaths(sweep).map(([a, b]) => segmentStrip(a, b, tol)),
    ]
    const c = compile({ start: sweep.start, moves: [...sweep.moves] })
    const samples = 1500
    for (let i = 0; i <= samples; i++) {
      const n = evaluate(c, (c.totalLength * i) / samples)
      expect(unionContainsSegment(region, n.a, needleB(n), tol, 0.02)).toBe(true)
    }
  }, 120_000)

  it('ends where it claims to end', () => {
    const sweep = kakeyaSweep(opts)
    const c = compile({ start: sweep.start, moves: [...sweep.moves] })
    const finish = evaluate(c, c.totalLength)
    const claimed = sweepEnd(sweep)
    expect(dist(finish.a, claimed.a)).toBeLessThan(1e-9)
    expect(finish.theta).toBeCloseTo(claimed.theta, 9)
  })
})

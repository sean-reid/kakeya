import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { palJoin, sectorPolygon, segmentStrip } from '../src/join'
import { compile, evaluate, needleB, type Needle } from '../src/motion'
import { area, unionContainsSegment, type Polygon } from '../src/polygon'
import { add, dir, dist, scale, vec } from '../src/vec'

const east: Needle = { a: vec(0, 0), theta: 0 }

const endOf = (start: Needle, targetA: ReturnType<typeof vec>, excursion: number) => {
  const join = palJoin(start, targetA, excursion)
  const c = compile({ start, moves: join.moves })
  return { join, end: evaluate(c, c.totalLength), compiled: c }
}

describe('palJoin end state', () => {
  it('lands exactly on the target needle', () => {
    const target = vec(0.3, 0.2)
    const { end } = endOf(east, target, -20)
    expect(end.a.x).toBeCloseTo(target.x, 10)
    expect(end.a.y).toBeCloseTo(target.y, 10)
    expect(end.theta).toBeCloseTo(east.theta, 10)
  })

  it('lands exactly for random parallel targets and excursions', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -2, max: 2, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }).filter((g) => Math.abs(g) > 1e-6),
        fc.double({ min: 5, max: 200, noNaN: true }),
        fc.double({ min: 0, max: Math.PI, noNaN: true }),
        (along, gap, excursion, theta) => {
          const start: Needle = { a: vec(0.1, -0.2), theta }
          const u = dir(theta)
          const n = vec(-u.y, u.x)
          const target = add(add(start.a, scale(u, along)), scale(n, gap))
          const { end } = endOf(start, target, -excursion)
          return dist(end.a, target) < 1e-9 && Math.abs(end.theta - theta) < 1e-9
        },
      ),
    )
  })

  it('handles the same-line case with a single slide', () => {
    const { join, end } = endOf(east, vec(3, 0), -10)
    expect(join.moves).toHaveLength(1)
    expect(join.area).toBe(0)
    expect(end.a.x).toBeCloseTo(3, 12)
  })

  it('rejects excursions too short for the gap', () => {
    expect(() => palJoin(east, vec(0, 1), -1.5)).toThrow()
  })
})

describe('palJoin area', () => {
  it('halves the tilt when the excursion doubles', () => {
    const j1 = palJoin(east, vec(0, 0.5), -20)
    const j2 = palJoin(east, vec(0, 0.5), -40)
    expect(j2.area).toBeLessThan(j1.area)
    expect(j2.area / j1.area).toBeCloseTo(0.5, 1)
  })

  it('approaches sigma = gap/excursion for far excursions', () => {
    const gap = 0.3
    const excursion = 1000
    const j = palJoin(east, vec(0, gap), -excursion)
    expect(j.sigma).toBeCloseTo(gap / excursion, 5)
  })

  it('sector fans carry area sigma/2 each', () => {
    const j = palJoin(east, vec(0.2, 0.6), -30)
    expect(j.sectors).toHaveLength(2)
    for (const s of j.sectors) {
      expect(area(s)).toBeCloseTo(Math.abs(j.sigma) / 2, 4)
    }
  })

  it('sectorPolygon spans the requested arc', () => {
    const s = sectorPolygon(vec(0, 0), 0, Math.PI / 2)
    expect(area(s)).toBeCloseTo(Math.PI / 4, 3)
  })
})

describe('palJoin containment', () => {
  it('the needle never leaves the sectors and traveled lines', () => {
    const tol = 1e-3
    const start: Needle = { a: vec(0.4, -0.1), theta: 0.7 }
    const target = add(
      start.a,
      add(scale(dir(0.7), 0.4), scale(vec(-Math.sin(0.7), Math.cos(0.7)), 0.35)),
    )
    const join = palJoin(start, target, -25)
    const region: Polygon[] = [
      ...join.sectors,
      ...join.paths.map(([a, b]) => segmentStrip(a, b, tol)),
    ]
    const c = compile({ start, moves: join.moves })
    const samples = 800
    for (let i = 0; i <= samples; i++) {
      const n = evaluate(c, (c.totalLength * i) / samples)
      expect(unionContainsSegment(region, n.a, needleB(n), tol, 0.02)).toBe(true)
    }
  }, 30_000)

  it('works when the target lies on the other side of the line', () => {
    const tol = 1e-3
    const target = vec(0.1, -0.4)
    const join = palJoin(east, target, -25)
    const region: Polygon[] = [
      ...join.sectors,
      ...join.paths.map(([a, b]) => segmentStrip(a, b, tol)),
    ]
    const c = compile({ start: east, moves: join.moves })
    for (let i = 0; i <= 400; i++) {
      const n = evaluate(c, (c.totalLength * i) / 400)
      expect(unionContainsSegment(region, n.a, needleB(n), tol, 0.02)).toBe(true)
    }
  }, 30_000)

  it('works with a forward excursion too', () => {
    const tol = 1e-3
    const target = vec(-0.2, 0.5)
    const join = palJoin(east, target, 25)
    const region: Polygon[] = [
      ...join.sectors,
      ...join.paths.map(([a, b]) => segmentStrip(a, b, tol)),
    ]
    const c = compile({ start: east, moves: join.moves })
    for (let i = 0; i <= 400; i++) {
      const n = evaluate(c, (c.totalLength * i) / 400)
      expect(unionContainsSegment(region, n.a, needleB(n), tol, 0.02)).toBe(true)
    }
  }, 30_000)
})

describe('segmentStrip', () => {
  it('builds a rectangle of the right area', () => {
    const s = segmentStrip(vec(0, 0), vec(4, 0), 0.5)
    expect(area(s)).toBeCloseTo(4, 12)
  })
})

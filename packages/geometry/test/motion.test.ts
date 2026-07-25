import { describe, expect, it } from 'vitest'
import {
  applyMove,
  compile,
  endState,
  evaluate,
  moveLength,
  needleB,
  type Move,
  type Needle,
  type Program,
} from '../src/motion'
import { dist, vec } from '../src/vec'

const east: Needle = { a: vec(0, 0), theta: 0 }

describe('applyMove', () => {
  it('slides along the needle line', () => {
    const n = applyMove(east, { kind: 'slide', distance: 2 })
    expect(n.a).toEqual(vec(2, 0))
    expect(n.theta).toBe(0)
  })

  it('slides backwards with negative distance', () => {
    const n = applyMove(east, { kind: 'slide', distance: -0.5 })
    expect(n.a).toEqual(vec(-0.5, 0))
  })

  it('turns about the a endpoint', () => {
    const n = applyMove(east, { kind: 'turn', pivot: vec(0, 0), angle: Math.PI / 2 })
    expect(n.a.x).toBeCloseTo(0, 12)
    expect(n.a.y).toBeCloseTo(0, 12)
    expect(needleB(n).x).toBeCloseTo(0, 12)
    expect(needleB(n).y).toBeCloseTo(1, 12)
  })

  it('turns about the b endpoint, moving a', () => {
    const n = applyMove(east, { kind: 'turn', pivot: vec(1, 0), angle: Math.PI })
    expect(n.a.x).toBeCloseTo(2, 12)
    expect(n.a.y).toBeCloseTo(0, 12)
  })

  it('interpolates a partial slide linearly', () => {
    const n = applyMove(east, { kind: 'slide', distance: 2 }, 0.25)
    expect(n.a).toEqual(vec(0.5, 0))
  })

  it('interpolates a partial turn along the circular arc', () => {
    const n = applyMove(east, { kind: 'turn', pivot: vec(0, 0), angle: Math.PI }, 0.5)
    expect(n.theta).toBeCloseTo(Math.PI / 2, 12)
    expect(dist(needleB(n), vec(0, 1))).toBeLessThan(1e-12)
  })

  it('preserves needle length under every move', () => {
    let n = east
    const moves: Move[] = [
      { kind: 'slide', distance: 3.7 },
      { kind: 'turn', pivot: vec(1, 2), angle: 1.1 },
      { kind: 'slide', distance: -0.9 },
      { kind: 'turn', pivot: vec(-4, 0.3), angle: -2.6 },
    ]
    for (const m of moves) {
      n = applyMove(n, m)
      expect(dist(n.a, needleB(n))).toBeCloseTo(1, 12)
    }
  })
})

describe('moveLength', () => {
  it('uses absolute distance for slides', () => {
    expect(moveLength(east, { kind: 'slide', distance: -3 })).toBe(3)
  })

  it('uses the farthest endpoint arc for turns', () => {
    expect(moveLength(east, { kind: 'turn', pivot: vec(0, 0), angle: Math.PI })).toBeCloseTo(
      Math.PI,
      12,
    )
    expect(moveLength(east, { kind: 'turn', pivot: vec(0.5, 0), angle: Math.PI })).toBeCloseTo(
      Math.PI / 2,
      12,
    )
  })
})

describe('compile and evaluate', () => {
  const program: Program = {
    start: east,
    moves: [
      { kind: 'slide', distance: 1 },
      { kind: 'turn', pivot: vec(1, 0), angle: Math.PI / 2 },
      { kind: 'slide', distance: 2 },
    ],
  }
  const compiled = compile(program)

  it('accumulates travel length across moves', () => {
    expect(compiled.totalLength).toBeCloseTo(1 + Math.PI / 2 + 2, 12)
  })

  it('evaluates the endpoints of the parameterization', () => {
    expect(evaluate(compiled, -1)).toEqual(program.start)
    const end = evaluate(compiled, compiled.totalLength + 1)
    expect(end.a.x).toBeCloseTo(endState(program).a.x, 12)
    expect(end.a.y).toBeCloseTo(endState(program).a.y, 12)
  })

  it('evaluates mid-move states', () => {
    const half = evaluate(compiled, 0.5)
    expect(half.a).toEqual(vec(0.5, 0))
    const midTurn = evaluate(compiled, 1 + Math.PI / 4)
    expect(midTurn.theta).toBeCloseTo(Math.PI / 4, 12)
  })

  it('is continuous: no jumps larger than the step anywhere', () => {
    const samples = 2000
    let prev = evaluate(compiled, 0)
    for (let i = 1; i <= samples; i++) {
      const s = (compiled.totalLength * i) / samples
      const cur = evaluate(compiled, s)
      const step = compiled.totalLength / samples
      expect(dist(prev.a, cur.a)).toBeLessThan(step * 1.01 + 1e-12)
      expect(Math.abs(cur.theta - prev.theta)).toBeLessThan(step * 1.01 + 1e-12)
      prev = cur
    }
  })

  it('travel length matches the actual path length of the a endpoint or better', () => {
    const samples = 5000
    let traveled = 0
    let prev = evaluate(compiled, 0)
    for (let i = 1; i <= samples; i++) {
      const cur = evaluate(compiled, (compiled.totalLength * i) / samples)
      traveled += dist(prev.a, cur.a)
      prev = cur
    }
    expect(traveled).toBeLessThanOrEqual(compiled.totalLength + 1e-6)
  })
})

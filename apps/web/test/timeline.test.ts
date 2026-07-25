import { compile, kakeyaSweep, type Program } from '@kakeya/geometry'
import { describe, expect, it } from 'vitest'
import { buildTimeline, progressToDistance } from '../src/engine/timeline'

const sweepTimeline = () => {
  const sweep = kakeyaSweep({ depth: 2, alpha: 0.75, joinExcursion: 50 })
  const compiled = compile({ start: sweep.start, moves: [...sweep.moves] })
  return { compiled, tl: buildTimeline(compiled) }
}

describe('buildTimeline', () => {
  it('compresses long slides against rotations', () => {
    const program: Program = {
      start: { a: { x: 0, y: 0 }, theta: 0 },
      moves: [
        { kind: 'slide', distance: 100 },
        { kind: 'turn', pivot: { x: 100, y: 0 }, angle: Math.PI / 2 },
      ],
    }
    const tl = buildTimeline(compile(program))
    const slideShare = tl.durations[1]! / tl.totalDuration
    expect(slideShare).toBeLessThan(0.1)
    expect(tl.totalDuration).toBeCloseTo(Math.log1p(100) + (Math.PI / 2) * 60, 10)
  })

  it('maps the endpoints exactly', () => {
    const { compiled, tl } = sweepTimeline()
    expect(progressToDistance(tl, 0)).toBe(0)
    expect(progressToDistance(tl, 1)).toBeCloseTo(compiled.totalLength, 9)
    expect(progressToDistance(tl, -0.5)).toBe(0)
    expect(progressToDistance(tl, 1.5)).toBeCloseTo(compiled.totalLength, 9)
  })

  it('is strictly monotone, so scrubbing never reverses the needle', () => {
    const { tl } = sweepTimeline()
    let prev = -1
    for (let i = 0; i <= 2000; i++) {
      const s = progressToDistance(tl, i / 2000)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })

  it('gives rotations the majority of the clock despite huge excursions', () => {
    const { compiled, tl } = sweepTimeline()
    const turnShare =
      compiled.program.moves.reduce(
        (sum, m, i) => (m.kind === 'turn' ? sum + (tl.durations[i + 1]! - tl.durations[i]!) : sum),
        0,
      ) / tl.totalDuration
    expect(turnShare).toBeGreaterThan(0.5)
  })
})

import { palJoin, type PalJoin } from './join'
import type { Move, Needle } from './motion'
import { equilateralFan, type PerronOptions, type PerronSlice } from './perron'
import type { Polygon } from './polygon'
import { rotate, type Vec } from './vec'

/**
 * The full Kakeya sweep: three Perron fans of sixty degrees each, rotated
 * into place, with Pal joins carrying the needle between consecutive slices
 * and across fan boundaries. One continuous program turns the needle through
 * a half turn - every direction - inside the drawn set.
 */
export interface SweepOptions extends PerronOptions {
  /** Magnitude of the backward slide taken before each join's tilt. */
  readonly joinExcursion: number
}

export type SweepSegment =
  | {
      readonly kind: 'rotate'
      readonly slice: number
      readonly moveStart: number
      readonly moveEnd: number
    }
  | {
      readonly kind: 'join'
      readonly join: number
      readonly moveStart: number
      readonly moveEnd: number
    }

export interface KakeyaSweep {
  readonly start: Needle
  readonly moves: readonly Move[]
  readonly slices: readonly PerronSlice[]
  readonly joins: readonly PalJoin[]
  readonly segments: readonly SweepSegment[]
  /** Sum of join sector areas: what the detours cost, over and above the tree. */
  readonly joinArea: number
}

const FAN_COUNT = 3
const FAN_ANGLE = Math.PI / 3

const rotateSlice = (s: PerronSlice, angle: number): PerronSlice => ({
  polygon: s.polygon.map((p) => rotate(p, angle)),
  apex: rotate(s.apex, angle),
  thetaIn: s.thetaIn + angle,
  thetaOut: s.thetaOut + angle,
  offset: s.offset,
})

const translateSlice = (s: PerronSlice, dx: number, dy: number): PerronSlice => ({
  polygon: s.polygon.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  apex: { x: s.apex.x + dx, y: s.apex.y + dy },
  thetaIn: s.thetaIn,
  thetaOut: s.thetaOut,
  offset: s.offset,
})

export const kakeyaSweep = (opts: SweepOptions): KakeyaSweep => {
  const fan = equilateralFan(opts)
  const slices: PerronSlice[] = []
  for (let f = 0; f < FAN_COUNT; f++) {
    // Translating a fan is free - directions are translation-invariant and
    // the joins carry the needle between any parallel positions - so the
    // three fans are centered on one point. Each fan's union is connected
    // (every pairing step overlaps through its heart), so the drawn set
    // becomes a single connected figure instead of three islands.
    const rotated = fan.map((s) => rotateSlice(s, f * FAN_ANGLE))
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const s of rotated) {
      for (const p of s.polygon) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
    }
    const dx = -(minX + maxX) / 2
    const dy = -(minY + maxY) / 2
    for (const s of rotated) slices.push(translateSlice(s, dx, dy))
  }

  const start: Needle = { a: slices[0]!.apex, theta: slices[0]!.thetaIn }
  const moves: Move[] = []
  const joins: PalJoin[] = []
  const segments: SweepSegment[] = []

  let theta = start.theta
  let apex: Vec = start.a

  slices.forEach((s, i) => {
    // Absorb float drift by turning to the slice's exit angle from wherever
    // the running direction actually is; the drift is at machine precision.
    const turn = s.thetaOut - theta
    const moveStart = moves.length
    moves.push({ kind: 'turn', pivot: s.apex, angle: turn })
    segments.push({ kind: 'rotate', slice: i, moveStart, moveEnd: moves.length })
    theta = s.thetaOut
    apex = s.apex

    const next = slices[i + 1]
    if (next) {
      const joinStart = moves.length
      const join = palJoin({ a: apex, theta }, next.apex, -opts.joinExcursion)
      joins.push(join)
      moves.push(...join.moves)
      segments.push({
        kind: 'join',
        join: joins.length - 1,
        moveStart: joinStart,
        moveEnd: moves.length,
      })
    }
  })

  return {
    start,
    moves,
    slices,
    joins,
    segments,
    joinArea: joins.reduce((sum, j) => sum + j.area, 0),
  }
}

/** Every polygon of the drawn set: slices plus join sectors. */
export const sweepPolygons = (sweep: KakeyaSweep): Polygon[] => [
  ...sweep.slices.map((s) => s.polygon),
  ...sweep.joins.flatMap((j) => [...j.sectors]),
]

/** The hairline segments the needle travels along between rotations. */
export const sweepPaths = (sweep: KakeyaSweep): (readonly [Vec, Vec])[] =>
  sweep.joins.flatMap((j) => [...j.paths])

/** Convenience origin needle for tests and scenes. */
export const sweepEnd = (sweep: KakeyaSweep): Needle => {
  const last = sweep.slices[sweep.slices.length - 1]!
  return { a: last.apex, theta: last.thetaOut }
}

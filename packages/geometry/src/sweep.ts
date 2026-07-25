import { palJoin, type PalJoin } from './join'
import type { Move, Needle } from './motion'
import { equilateralFan, perronHeart, type PerronOptions, type PerronSlice } from './perron'
import type { Polygon } from './polygon'
import { cross, dir, rotate, sub, type Vec } from './vec'

/**
 * The full Kakeya sweep: three Perron fans of sixty degrees each, rotated
 * into place, with Pal joins carrying the needle between consecutive slices
 * and across fan boundaries. One continuous program turns the needle through
 * a half turn - every direction - inside the drawn set.
 */
export interface SweepOptions extends PerronOptions {
  /**
   * Base magnitude of the slide taken before each join's tilt. Joins whose
   * line gap is too wide for it stretch further automatically (the tilt must
   * stay well under a quarter turn). Every excursion leaves through its
   * fan's BASE side, into the empty sectors between the spike bundles, so
   * the detours fill the figure's gaps instead of enlarging it.
   */
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
  // Translating a fan is free - directions are translation-invariant and the
  // joins carry the needle between any parallel positions. Following the
  // classical assembled pictures, the fans are rotated by 0, 120, and 240
  // degrees and anchored by the centroid of the heart triangle: an
  // equilateral heart is invariant under 120-degree turns about its
  // centroid, so the three hearts COINCIDE into one central triangle with
  // the spike bundles pointing symmetrically outward. Needle directions are
  // mod 180, so this tiles all of them - the middle stretch is traversed
  // with the needle reversed (parity below), which changes nothing about
  // which points it covers.
  const half = 1 / Math.sqrt(3)
  const heart = perronHeart(-half, half, opts)
  const heartHeight = heart.w / (2 * half)
  const anchor = { x: heart.x + heart.w / 2, y: heartHeight / 3 }

  // In needle-theta order: [-120,-60] normal, [-60,0] reversed (the 240-degree
  // fan read backwards through the mod-pi mirror), [0,60] normal.
  const FAN_LAYOUT: readonly { rotation: number; reversed: boolean }[] = [
    { rotation: 0, reversed: false },
    { rotation: (4 * Math.PI) / 3, reversed: true },
    { rotation: (2 * Math.PI) / 3, reversed: false },
  ]

  const slices: PerronSlice[] = []
  const parity: boolean[] = []
  for (const { rotation, reversed } of FAN_LAYOUT) {
    const turned = rotate(anchor, rotation)
    for (const s of fan) {
      slices.push(translateSlice(rotateSlice(s, rotation), -turned.x, -turned.y))
      parity.push(reversed)
    }
  }

  // The needle's anchor for a slice: at the apex pointing down the edge when
  // normal, at the edge's far end pointing back at the apex when reversed.
  const needleAt = (i: number, edgeTheta: number): Needle => {
    const s = slices[i]!
    if (!parity[i]) return { a: s.apex, theta: edgeTheta }
    const tip = dir(edgeTheta)
    return { a: { x: s.apex.x + tip.x, y: s.apex.y + tip.y }, theta: edgeTheta - Math.PI }
  }

  const start: Needle = needleAt(0, slices[0]!.thetaIn)
  const moves: Move[] = []
  const joins: PalJoin[] = []
  const segments: SweepSegment[] = []

  let theta = start.theta

  slices.forEach((s, i) => {
    // Absorb float drift by turning to the slice's exit angle from wherever
    // the running direction actually is; the drift is at machine precision.
    const exitTheta = parity[i] ? s.thetaOut - Math.PI : s.thetaOut
    const turn = exitTheta - theta
    const moveStart = moves.length
    moves.push({ kind: 'turn', pivot: s.apex, angle: turn })
    segments.push({ kind: 'rotate', slice: i, moveStart, moveEnd: moves.length })
    theta = exitTheta

    const next = slices[i + 1]
    if (next) {
      const joinStart = moves.length
      const from = needleAt(i, s.thetaOut)
      const to = needleAt(i + 1, next.thetaIn)
      const gap = Math.abs(cross(dir(theta), sub(to.a, from.a)))
      const magnitude = Math.max(opts.joinExcursion, 2.5 * gap)
      const join = palJoin({ a: from.a, theta }, to.a, parity[i] ? -magnitude : magnitude)
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

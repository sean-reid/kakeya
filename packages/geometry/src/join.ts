import type { Move, Needle } from './motion'
import type { Polygon } from './polygon'
import type { Vec } from './vec'
import { add, cross, dir, len, scale, sub, vec } from './vec'

/**
 * Pál join: carry the needle from its line to a parallel line at perpendicular
 * distance d, sweeping only two thin circular sectors. The needle slides far
 * out along its own line, tilts by a small angle toward the target, slides
 * across, and tilts back. The farther the excursion, the smaller the tilt,
 * and the swept area (one sector per tilt, sigma/2 each) shrinks like d/N.
 */
export interface PalJoin {
  readonly moves: readonly Move[]
  /** The two swept sectors, as fan polygons, for drawing and area accounting. */
  readonly sectors: readonly Polygon[]
  /** Hairline segments the needle travels along (measure zero, drawn as lines). */
  readonly paths: readonly (readonly [Vec, Vec])[]
  /** Exact swept area: two sectors of radius 1 and angle |sigma|. */
  readonly area: number
  readonly sigma: number
}

const SECTOR_ARC_STEPS = 32

/**
 * Fan polygon for the unit-radius sector swept about pivot from angle a0 to
 * a1, always wound counterclockwise: a clockwise polygon cancels against
 * counterclockwise neighbors under nonzero-winding fills and punches paper-
 * colored holes in the drawn set.
 */
export const sectorPolygon = (pivot: Vec, a0: number, a1: number): Polygon => {
  const lo = Math.min(a0, a1)
  const hi = Math.max(a0, a1)
  const pts: Vec[] = [pivot]
  for (let i = 0; i <= SECTOR_ARC_STEPS; i++) {
    const ang = lo + ((hi - lo) * i) / SECTOR_ARC_STEPS
    pts.push(add(pivot, dir(ang)))
  }
  return pts
}

/**
 * Build the join carrying `start` to the needle at `targetA` with the same theta.
 * `excursion` is the signed slide taken along the needle's own line first;
 * its magnitude must comfortably exceed the line gap so the tilt stays small.
 */
export const palJoin = (start: Needle, targetA: Vec, excursion: number): PalJoin => {
  const u = dir(start.theta)
  const gap = cross(u, sub(targetA, start.a))

  if (Math.abs(gap) < 1e-12) {
    const along = sub(targetA, start.a)
    const distance = Math.sign(along.x * u.x + along.y * u.y || 1) * len(along)
    return {
      moves: [{ kind: 'slide', distance }],
      sectors: [],
      paths: [[start.a, add(targetA, u)]],
      area: 0,
      sigma: 0,
    }
  }

  if (Math.abs(excursion) <= 2 * Math.abs(gap)) {
    throw new Error('palJoin: excursion too short for the line gap; the tilt would not be small')
  }

  const pivot = add(start.a, scale(u, excursion))
  const toTarget = sub(targetA, pivot)
  // The tilted line through pivot and targetA, oriented to stay within a
  // quarter turn of the needle so the tilt sigma is the small angle.
  const forward = toTarget.x * u.x + toTarget.y * u.y >= 0 ? 1 : -1
  const lineVec = scale(toTarget, forward)
  const sigma = Math.atan2(cross(u, lineVec), lineVec.x * u.x + lineVec.y * u.y)
  const crossDistance = forward * len(toTarget)

  const moves: Move[] = [
    { kind: 'slide', distance: excursion },
    { kind: 'turn', pivot, angle: sigma },
    { kind: 'slide', distance: crossDistance },
    { kind: 'turn', pivot: targetA, angle: -sigma },
  ]

  const sectors = [
    sectorPolygon(pivot, start.theta, start.theta + sigma),
    sectorPolygon(targetA, start.theta + sigma, start.theta),
  ]

  const startB = add(start.a, u)
  const tilted = dir(start.theta + sigma)
  const paths: (readonly [Vec, Vec])[] = [
    [excursion < 0 ? pivot : start.a, excursion < 0 ? startB : add(pivot, u)],
    [crossDistance >= 0 ? pivot : targetA, add(crossDistance >= 0 ? targetA : pivot, tilted)],
    [targetA, add(targetA, u)],
  ]

  return { moves, sectors, paths, area: Math.abs(sigma), sigma }
}

/** The vertices of a strip of half-width w around segment ab, for containment checks. */
export const segmentStrip = (a: Vec, b: Vec, w: number): Polygon => {
  const d = sub(b, a)
  const l = len(d)
  const n = l === 0 ? vec(0, w) : vec((-d.y / l) * w, (d.x / l) * w)
  return [add(a, n), add(b, n), sub(b, n), sub(a, n)]
}

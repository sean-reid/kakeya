import type { CompiledProgram } from '@kakeya/geometry'

/**
 * Presentation clock for a motion program. The PATH the needle takes is exact;
 * only the pacing is shaped: rotations play proportional to angle swept, and
 * the joins' long slides are compressed logarithmically so a
 * hundred-unit excursion reads as a moment, not a minute. Mapping progress
 * u in [0,1] to travel distance s is strictly monotone, so scrubbing can
 * never run the needle backwards.
 */
export interface Timeline {
  readonly compiled: CompiledProgram
  /** Presentation duration accumulated at the start of each move. */
  readonly durations: readonly number[]
  readonly totalDuration: number
}

export interface PacingOptions {
  /** Maps a slide's total distance to its presentation duration. */
  readonly slideCompression?: (distance: number) => number
  /** Presentation time per radian of rotation. */
  readonly turnWeight?: number
}

const defaultSlideCompression = (d: number): number => Math.log1p(d)
const DEFAULT_TURN_WEIGHT = 60

export const buildTimeline = (compiled: CompiledProgram, pacing: PacingOptions = {}): Timeline => {
  const slide = pacing.slideCompression ?? defaultSlideCompression
  const turnWeight = pacing.turnWeight ?? DEFAULT_TURN_WEIGHT
  const durations: number[] = [0]
  let total = 0
  compiled.program.moves.forEach((m, i) => {
    const length = compiled.offsets[i + 1]! - compiled.offsets[i]!
    total += m.kind === 'slide' ? slide(length) : Math.abs(m.angle) * turnWeight
    durations.push(total)
  })
  return { compiled, durations, totalDuration: total }
}

/** Progress u in [0,1] for travel distance s - the inverse of progressToDistance. */
export const distanceToProgress = (tl: Timeline, s: number): number => {
  const { compiled, durations, totalDuration } = tl
  if (totalDuration === 0) return 0
  const target = Math.min(Math.max(s, 0), compiled.totalLength)
  let lo = 0
  let hi = compiled.offsets.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (compiled.offsets[mid]! <= target) lo = mid
    else hi = mid - 1
  }
  const span = compiled.offsets[lo + 1]! - compiled.offsets[lo]!
  const fraction = span === 0 ? 1 : (target - compiled.offsets[lo]!) / span
  const d0 = durations[lo]!
  const d1 = durations[lo + 1]!
  return (d0 + (d1 - d0) * fraction) / totalDuration
}

/** Travel distance s for progress u in [0,1]. */
export const progressToDistance = (tl: Timeline, u: number): number => {
  const { compiled, durations, totalDuration } = tl
  if (totalDuration === 0) return 0
  const target = Math.min(Math.max(u, 0), 1) * totalDuration
  let lo = 0
  let hi = durations.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (durations[mid]! <= target) lo = mid
    else hi = mid - 1
  }
  const span = durations[lo + 1]! - durations[lo]!
  const fraction = span === 0 ? 1 : (target - durations[lo]!) / span
  const s0 = compiled.offsets[lo]!
  const s1 = compiled.offsets[lo + 1]!
  return s0 + (s1 - s0) * fraction
}

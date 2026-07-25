import type { Vec } from './vec'
import { add, dir, dist, rotateAbout, scale, vec } from './vec'

/**
 * A needle is a unit segment from `a` toward angle `theta`.
 * Motion is a program of two primitives: slide along the needle's own line,
 * and turn about a pivot. Every animated needle on the site evaluates one of
 * these programs, so a position that leaves the swept set cannot be drawn by
 * accident - the program IS the motion.
 */
export interface Needle {
  readonly a: Vec
  readonly theta: number
}

export const needleB = (n: Needle): Vec => add(n.a, dir(n.theta))

export type Move =
  | { readonly kind: 'slide'; readonly distance: number }
  | { readonly kind: 'turn'; readonly pivot: Vec; readonly angle: number }

export interface Program {
  readonly start: Needle
  readonly moves: readonly Move[]
}

export const applyMove = (n: Needle, m: Move, fraction = 1): Needle => {
  if (m.kind === 'slide') {
    return { a: add(n.a, scale(dir(n.theta), m.distance * fraction)), theta: n.theta }
  }
  const angle = m.angle * fraction
  return { a: rotateAbout(n.a, m.pivot, angle), theta: n.theta + angle }
}

export const endState = (p: Program): Needle => p.moves.reduce((n, m) => applyMove(n, m), p.start)

/** How far the needle travels during a move, for time parameterization. */
export const moveLength = (n: Needle, m: Move): number => {
  if (m.kind === 'slide') return Math.abs(m.distance)
  const ra = dist(n.a, m.pivot)
  const rb = dist(needleB(n), m.pivot)
  return Math.abs(m.angle) * Math.max(ra, rb)
}

export interface CompiledProgram {
  readonly program: Program
  /** Needle state at the start of each move. */
  readonly states: readonly Needle[]
  /** Cumulative travel length at the start of each move, plus the total at the end. */
  readonly offsets: readonly number[]
  readonly totalLength: number
}

export const compile = (p: Program): CompiledProgram => {
  const states: Needle[] = [p.start]
  const offsets: number[] = [0]
  let n = p.start
  let s = 0
  for (const m of p.moves) {
    s += moveLength(n, m)
    n = applyMove(n, m)
    states.push(n)
    offsets.push(s)
  }
  return { program: p, states, offsets, totalLength: s }
}

/** Needle state at travel distance s in [0, totalLength]. */
export const evaluate = (c: CompiledProgram, s: number): Needle => {
  const { program, states, offsets, totalLength } = c
  if (s <= 0) return program.start
  if (s >= totalLength) return states[states.length - 1]!
  let lo = 0
  let hi = program.moves.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid]! <= s) lo = mid
    else hi = mid - 1
  }
  const span = offsets[lo + 1]! - offsets[lo]!
  const fraction = span === 0 ? 1 : (s - offsets[lo]!) / span
  return applyMove(states[lo]!, program.moves[lo]!, fraction)
}

/** Needle midpoint, handy for cameras and tests. */
export const needleMid = (n: Needle): Vec => {
  const b = needleB(n)
  return vec((n.a.x + b.x) / 2, (n.a.y + b.y) / 2)
}

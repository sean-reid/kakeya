import type { Polygon } from './polygon'
import type { Vec } from './vec'
import { vec } from './vec'

/**
 * Perron tree: slice a triangle into 2^depth thin triangles from its apex and
 * slide them horizontally into heavy overlap. Each slice stays an exact
 * translate of itself, so a unit needle still turns about the slice's own
 * apex; the union's area collapses as depth grows.
 *
 * The recursion follows Besicovitch's scheme as simplified by Perron and
 * presented by Falconer: pair adjacent groups, place the right group so the
 * two "hearts" (the alpha-scaled similar triangles the groups carry) sit
 * adjacent as halves of one parent triangle, then pull it back left by
 * (1 - alpha) times that parent's base width. One elementary step with
 * overlap parameter alpha turns area A into (3*alpha^2 - 4*alpha + 2) * A.
 */
export interface PerronOptions {
  /** Number of pairing stages; 2^depth slices. */
  readonly depth: number
  /** Overlap parameter, strictly between 1/2 and 1. */
  readonly alpha: number
}

export interface PerronSlice {
  /** The translated slice, apex last. */
  readonly polygon: Polygon
  /** The slice's own translated apex - the needle's pivot. */
  readonly apex: Vec
  /** Needle direction (apex toward base) entering the slice. */
  readonly thetaIn: number
  /** Needle direction leaving the slice; thetaOut of slice i equals thetaIn of slice i+1. */
  readonly thetaOut: number
  /** Horizontal offset this slice was carried by. */
  readonly offset: number
}

/**
 * Horizontal offsets for the 2^depth slices of a triangle with base [a, c].
 * Pure bookkeeping on base intervals: hearts at each stage all share one
 * width, and only the right member of each pair moves.
 */
interface PerronLayout {
  readonly offsets: readonly number[]
  /** Left end and width of the final heart's base interval. */
  readonly heartX: number
  readonly heartW: number
}

const perronLayout = (a: number, c: number, opts: PerronOptions): PerronLayout => {
  const { depth, alpha } = opts
  if (!(alpha > 0.5 && alpha < 1)) throw new Error('perron: alpha must lie in (1/2, 1)')
  if (!Number.isInteger(depth) || depth < 0) throw new Error('perron: depth must be a whole number')

  const n = 2 ** depth
  const w = (c - a) / n

  let monsters: PerronLayout[] = []
  for (let i = 0; i < n; i++) {
    monsters.push({ offsets: [0], heartX: a + i * w, heartW: w })
  }

  while (monsters.length > 1) {
    const next: PerronLayout[] = []
    for (let i = 0; i < monsters.length; i += 2) {
      const left = monsters[i]!
      const right = monsters[i + 1]!
      const adjacency = left.heartX + left.heartW - right.heartX
      const t = adjacency - (1 - alpha) * 2 * left.heartW
      next.push({
        offsets: [...left.offsets, ...right.offsets.map((e) => e + t)],
        heartX: left.heartX,
        heartW: 2 * alpha * left.heartW,
      })
    }
    monsters = next
  }

  return monsters[0]!
}

export const perronOffsets = (a: number, c: number, opts: PerronOptions): number[] => [
  ...perronLayout(a, c, opts).offsets,
]

/**
 * Base interval of the tree's heart - the densest, trunk-like part of the
 * figure. The assembled set overlaps the three fans here, matching the
 * classical pictures and buying a little extra area for free.
 */
export const perronHeart = (
  a: number,
  c: number,
  opts: PerronOptions,
): { readonly x: number; readonly w: number } => {
  const layout = perronLayout(a, c, opts)
  return { x: layout.heartX, w: layout.heartW }
}

/**
 * Build the translated slices of the triangle with apex P and base [a, c] on
 * the x-axis. The apex must sit at height >= 1 so a unit needle turns inside
 * every slice about its apex.
 */
export const perronTree = (apex: Vec, a: number, c: number, opts: PerronOptions): PerronSlice[] => {
  if (apex.y < 1) throw new Error('perron: apex height below 1 cannot turn a unit needle')
  const offsets = perronOffsets(a, c, opts)
  const n = offsets.length
  const w = (c - a) / n

  const edgeAngle = (x: number): number => Math.atan2(-apex.y, x - apex.x)

  return offsets.map((offset, i) => {
    const x0 = a + i * w
    const x1 = x0 + w
    return {
      polygon: [vec(x0 + offset, 0), vec(x1 + offset, 0), vec(apex.x + offset, apex.y)],
      apex: vec(apex.x + offset, apex.y),
      thetaIn: edgeAngle(x0),
      thetaOut: edgeAngle(x1),
      offset,
    }
  })
}

/** Chang's closed-form upper bound on union area over triangle area at a given depth. */
export const perronAreaUpperBound = (opts: PerronOptions): number => {
  const { depth, alpha } = opts
  const a2k = alpha ** (2 * depth)
  return a2k + (2 * (1 - alpha) ** 2 * (1 - a2k)) / (1 - alpha * alpha)
}

/**
 * Falconer's guaranteed-savings bound: the union area over triangle area is
 * at most 1 - (3a-1)(1 - a^2k)/(1+a). The guarantee only materializes when
 * every pairing lands its hearts in exactly the right overlap, so measured
 * areas sitting under (and near) this line verify the translated positions.
 */
export const falconerAreaBound = (opts: PerronOptions): number => {
  const { depth, alpha } = opts
  return 1 - ((3 * alpha - 1) * (1 - alpha ** (2 * depth))) / (1 + alpha)
}

/** The canonical fan: equilateral triangle of height 1, apex up, 60 degrees of directions. */
export const equilateralFan = (opts: PerronOptions): PerronSlice[] => {
  const half = 1 / Math.sqrt(3)
  return perronTree(vec(0, 1), -half, half, opts)
}

import type { Polygon } from './polygon'
import type { Vec } from './vec'
import { scale, vec } from './vec'

/**
 * The deltoid traced by a circle of radius r rolling inside a circle of radius 3r.
 * A needle of length 4r turns fully around inside it, staying tangent with both
 * ends on the curve the whole way. Kakeya's guessed answer, area 2*pi*r^2.
 */

/** Boundary point at parameter u. Cusps sit at u = 0, 2*pi/3, 4*pi/3. */
export const deltoidPoint = (r: number, u: number): Vec =>
  scale(vec(2 * Math.cos(u) + Math.cos(2 * u), 2 * Math.sin(u) - Math.sin(2 * u)), r)

export const deltoidArea = (r: number): number => 2 * Math.PI * r * r

/** Rolling-circle radius that gives the tangent chord (the needle) length 1. */
export const UNIT_NEEDLE_R = 1 / 4

export interface DeltoidNeedle {
  /** Needle endpoints, both on the deltoid. */
  readonly a: Vec
  readonly b: Vec
  /** Where the needle touches the curve between its ends. */
  readonly touch: Vec
  /** Undirected needle direction in [0, pi). */
  readonly angle: number
}

/**
 * Needle position at parameter t in [0, 2*pi). The tangent line at P(t) meets
 * the deltoid again at exactly P(-t/2) and P(pi - t/2); the chord between them
 * has constant length 4r and rotates through a half turn as t runs once around.
 */
export const deltoidNeedle = (r: number, t: number): DeltoidNeedle => {
  const s = t / 2
  const a = deltoidPoint(r, -s)
  const b = deltoidPoint(r, Math.PI - s)
  const angle = (((Math.PI - s) % Math.PI) + Math.PI) % Math.PI
  return { a, b, touch: deltoidPoint(r, t), angle }
}

/** Inscribed boundary polygon with n vertices, for containment checks and rendering. */
export const deltoidPolygon = (r: number, n: number): Polygon => {
  const pts: Vec[] = []
  for (let i = 0; i < n; i++) {
    pts.push(deltoidPoint(r, (2 * Math.PI * i) / n))
  }
  return pts
}

import type { Vec } from './vec'
import { dist, dot, sub, vec } from './vec'

export type Polygon = readonly Vec[]

/** Signed area by the shoelace formula: positive when vertices wind counterclockwise. */
export const signedArea = (poly: Polygon): number => {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

export const area = (poly: Polygon): number => Math.abs(signedArea(poly))

/**
 * Ray-cast parity test. Points exactly on the boundary are not reliably
 * classified; callers that care about the boundary use `contains` with a tolerance.
 */
export const strictlyInside = (poly: Polygon, p: Vec): boolean => {
  let inside = false
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    if (a.y > p.y !== b.y > p.y) {
      const xCross = a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x)
      if (p.x < xCross) inside = !inside
    }
  }
  return inside
}

export const distToSegment = (p: Vec, a: Vec, b: Vec): number => {
  const ab = sub(b, a)
  const lenSq = dot(ab, ab)
  if (lenSq === 0) return dist(p, a)
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / lenSq))
  return dist(p, vec(a.x + ab.x * t, a.y + ab.y * t))
}

export const distToBoundary = (p: Vec, poly: Polygon): number => {
  let min = Infinity
  for (let i = 0; i < poly.length; i++) {
    const d = distToSegment(p, poly[i]!, poly[(i + 1) % poly.length]!)
    if (d < min) min = d
  }
  return min
}

/** True when p lies inside poly or within tol of its boundary. */
export const contains = (poly: Polygon, p: Vec, tol: number): boolean =>
  strictlyInside(poly, p) || distToBoundary(p, poly) <= tol

export const unionContains = (polys: readonly Polygon[], p: Vec, tol: number): boolean =>
  polys.some((poly) => contains(poly, p, tol))

/**
 * Check that segment ab lies in the union by sampling at spacing `step`.
 * Sampling is the documented verification strategy: tol and step are chosen
 * together so a gap wider than the render scale cannot slip between samples.
 */
export const unionContainsSegment = (
  polys: readonly Polygon[],
  a: Vec,
  b: Vec,
  tol: number,
  step: number,
): boolean => {
  const n = Math.max(1, Math.ceil(dist(a, b) / step))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const p = vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
    if (!unionContains(polys, p, tol)) return false
  }
  return true
}

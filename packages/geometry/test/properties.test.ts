import fc from 'fast-check'
import { describe, it } from 'vitest'
import { applyMove, compile, evaluate, needleB, type Move, type Program } from '../src/motion'
import { area, contains, signedArea, strictlyInside } from '../src/polygon'
import { dist, vec } from '../src/vec'

const arbVec = fc
  .tuple(
    fc.double({ min: -50, max: 50, noNaN: true }),
    fc.double({ min: -50, max: 50, noNaN: true }),
  )
  .map(([x, y]) => vec(x, y))

const arbMove: fc.Arbitrary<Move> = fc.oneof(
  fc
    .double({ min: -100, max: 100, noNaN: true })
    .map((distance): Move => ({ kind: 'slide', distance })),
  fc
    .tuple(arbVec, fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }))
    .map(([pivot, angle]): Move => ({ kind: 'turn', pivot, angle })),
)

const arbProgram: fc.Arbitrary<Program> = fc
  .tuple(
    arbVec,
    fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
    fc.array(arbMove, { maxLength: 30 }),
  )
  .map(([a, theta, moves]) => ({ start: { a, theta }, moves }))

/** Random convex polygon around the origin: sorted angles, positive radii. */
const arbConvexPolygon = fc
  .array(fc.double({ min: 0.01, max: 2 * Math.PI - 0.01, noNaN: true }), {
    minLength: 3,
    maxLength: 12,
  })
  .chain((angles) =>
    fc
      .double({ min: 0.5, max: 20, noNaN: true })
      .map((radius) =>
        [...new Set(angles)]
          .sort((p, q) => p - q)
          .map((ang) => vec(radius * Math.cos(ang), radius * Math.sin(ang))),
      ),
  )
  .filter((poly) => poly.length >= 3)

describe('motion properties', () => {
  it('every program preserves needle length exactly', () => {
    fc.assert(
      fc.property(arbProgram, (p) => {
        let n = p.start
        for (const m of p.moves) {
          n = applyMove(n, m)
          if (Math.abs(dist(n.a, needleB(n)) - 1) > 1e-9) return false
        }
        return true
      }),
    )
  })

  it('evaluation at any parameter yields a unit needle', () => {
    fc.assert(
      fc.property(arbProgram, fc.double({ min: 0, max: 1, noNaN: true }), (p, frac) => {
        const c = compile(p)
        const n = evaluate(c, c.totalLength * frac)
        return Math.abs(dist(n.a, needleB(n)) - 1) < 1e-9
      }),
    )
  })

  it('nearby parameters yield nearby needles', () => {
    fc.assert(
      fc.property(arbProgram, fc.double({ min: 0, max: 1, noNaN: true }), (p, frac) => {
        const c = compile(p)
        if (c.totalLength === 0) return true
        const eps = c.totalLength * 1e-6
        const s = c.totalLength * frac
        const n1 = evaluate(c, Math.max(0, s - eps))
        const n2 = evaluate(c, Math.min(c.totalLength, s + eps))
        return dist(n1.a, n2.a) <= 2.5 * eps + 1e-9
      }),
    )
  })
})

describe('polygon properties', () => {
  it('reversing orientation flips the signed area', () => {
    fc.assert(
      fc.property(arbConvexPolygon, (poly) => {
        const s = signedArea(poly)
        const rev = signedArea([...poly].reverse())
        return Math.abs(s + rev) < 1e-9
      }),
    )
  })

  it('a convex polygon contains its vertex average', () => {
    fc.assert(
      fc.property(arbConvexPolygon, (poly) => {
        const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length
        const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length
        return contains(poly, vec(cx, cy), 1e-9)
      }),
    )
  })

  it('no polygon of bounded extent contains a point far outside it', () => {
    fc.assert(fc.property(arbConvexPolygon, (poly) => !strictlyInside(poly, vec(1000, 1000))))
  })

  it('area is nonnegative and bounded by the enclosing disc', () => {
    fc.assert(
      fc.property(arbConvexPolygon, (poly) => {
        const rMax = Math.max(...poly.map((p) => Math.hypot(p.x, p.y)))
        const a = area(poly)
        return a >= 0 && a <= Math.PI * rMax * rMax + 1e-9
      }),
    )
  })
})

import { describe, expect, it } from 'vitest'
import { add, cross, dir, dist, dot, len, rotate, rotateAbout, scale, sub, vec } from '../src/vec'

describe('vec', () => {
  it('adds and subtracts componentwise', () => {
    expect(add(vec(1, 2), vec(3, -4))).toEqual(vec(4, -2))
    expect(sub(vec(1, 2), vec(3, -4))).toEqual(vec(-2, 6))
  })

  it('scales, dots, crosses', () => {
    expect(scale(vec(2, -3), -2)).toEqual(vec(-4, 6))
    expect(dot(vec(1, 2), vec(3, 4))).toBe(11)
    expect(cross(vec(1, 0), vec(0, 1))).toBe(1)
    expect(cross(vec(0, 1), vec(1, 0))).toBe(-1)
  })

  it('measures length and distance', () => {
    expect(len(vec(3, 4))).toBe(5)
    expect(dist(vec(1, 1), vec(4, 5))).toBe(5)
  })

  it('builds unit direction vectors', () => {
    expect(dir(0)).toEqual(vec(1, 0))
    expect(dir(Math.PI / 2).x).toBeCloseTo(0, 12)
    expect(dir(Math.PI / 2).y).toBeCloseTo(1, 12)
  })

  it('rotates about origin and pivot', () => {
    const r = rotate(vec(1, 0), Math.PI / 2)
    expect(r.x).toBeCloseTo(0, 12)
    expect(r.y).toBeCloseTo(1, 12)

    const p = rotateAbout(vec(2, 1), vec(1, 1), Math.PI)
    expect(p.x).toBeCloseTo(0, 12)
    expect(p.y).toBeCloseTo(1, 12)
  })

  it('rotation preserves length', () => {
    const a = vec(0.37, -1.9)
    expect(len(rotate(a, 1.234))).toBeCloseTo(len(a), 12)
  })
})

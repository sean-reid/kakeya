import { describe, expect, it } from 'vitest'
import {
  UNIT_NEEDLE_R,
  deltoidArea,
  deltoidNeedle,
  deltoidPoint,
  deltoidPolygon,
} from '../src/deltoid'
import { area, distToBoundary, distToSegment, unionContainsSegment } from '../src/polygon'
import { dist } from '../src/vec'

const r = UNIT_NEEDLE_R
const steps = 720

describe('deltoid needle', () => {
  it('has length exactly one at every parameter', () => {
    for (let i = 0; i < steps; i++) {
      const t = (2 * Math.PI * i) / steps
      const { a, b } = deltoidNeedle(r, t)
      expect(dist(a, b)).toBeCloseTo(1, 12)
    }
  })

  it('keeps both endpoints on the curve', () => {
    const boundary = deltoidPolygon(r, 4096)
    for (let i = 0; i < steps; i++) {
      const t = (2 * Math.PI * i) / steps
      const { a, b } = deltoidNeedle(r, t)
      expect(distToBoundary(a, boundary)).toBeLessThan(1e-5)
      expect(distToBoundary(b, boundary)).toBeLessThan(1e-5)
    }
  })

  it('touches the curve between its ends', () => {
    for (let i = 0; i < steps; i++) {
      const t = (2 * Math.PI * i) / steps
      const { a, b, touch } = deltoidNeedle(r, t)
      expect(distToSegment(touch, a, b)).toBeLessThan(1e-12)
    }
  })

  it('stays inside the deltoid the whole way around', () => {
    const region = [deltoidPolygon(r, 1024)]
    for (let i = 0; i < 360; i++) {
      const t = (2 * Math.PI * i) / 360
      const { a, b } = deltoidNeedle(r, t)
      expect(unionContainsSegment(region, a, b, 2e-4, 2e-3)).toBe(true)
    }
  }, 30_000)

  it('turns through every direction exactly once per revolution', () => {
    const angles: number[] = []
    for (let i = 0; i < steps; i++) {
      angles.push(deltoidNeedle(r, (2 * Math.PI * i) / steps).angle)
    }
    let wraps = 0
    for (let i = 1; i < steps; i++) {
      const d = angles[i]! - angles[i - 1]!
      if (Math.abs(d) > Math.PI / 2) wraps++
      else expect(d).toBeLessThan(0)
    }
    expect(wraps).toBe(1)
    const sorted = [...angles].sort((x, y) => x - y)
    expect(sorted[0]!).toBeLessThan(0.01)
    expect(sorted[steps - 1]!).toBeGreaterThan(Math.PI - 0.01)
    for (let i = 1; i < steps; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeLessThan(0.02)
    }
  })
})

describe('deltoid region', () => {
  it('has area 2*pi*r^2, about 0.3927 for the unit needle', () => {
    expect(deltoidArea(r)).toBeCloseTo(Math.PI / 8, 12)
    expect(area(deltoidPolygon(r, 8192))).toBeCloseTo(Math.PI / 8, 4)
  })

  it('is much smaller than the half disc it replaces', () => {
    expect(deltoidArea(r)).toBeLessThan(Math.PI / 2)
  })

  it('places cusps at the expected parameters', () => {
    const cusp = deltoidPoint(r, 0)
    expect(cusp.x).toBeCloseTo(3 * r, 12)
    expect(cusp.y).toBeCloseTo(0, 12)
  })
})

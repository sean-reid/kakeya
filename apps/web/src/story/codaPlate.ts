import { equilateralFan, type Polygon } from '@kakeya/geometry'
import { worldToScreen } from '../engine/camera'
import type { Painter } from '../paint/painter'
import { INK, PENCIL, RED, WASH_EDGE, WASH_FLAT } from '../paint/styles'

/**
 * The closing plate: a hand-drawing of the same game in space. A pencil of
 * planes fans through one common line; each plane could carry its own flat
 * construction, and every direction in space lies in some plane of the fan.
 * Drawn with an oblique projection - ink on paper, no 3D machinery.
 */
const OBLIQUE_X = 0.42
const OBLIQUE_Y = 0.26

interface P3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

const project = (p: P3): { x: number; y: number } => ({
  x: p.x + OBLIQUE_X * p.z,
  y: p.y + OBLIQUE_Y * p.z,
})

/** A point in the plane through the y-axis at angle phi, at plane coords (u, v). */
const inPlane = (phi: number, u: number, v: number): P3 => ({
  x: u * Math.cos(phi),
  y: v,
  z: -u * Math.sin(phi),
})

const PLANES = 7
const HALF_WIDTH = 1.35
const HALF_HEIGHT = 0.85

const tracePath = (p: Painter, pts: { x: number; y: number }[], close: boolean): void => {
  const { ctx, transform } = p
  ctx.beginPath()
  pts.forEach((w, i) => {
    const s = worldToScreen(transform, w.x, w.y)
    if (i === 0) ctx.moveTo(s.x, s.y)
    else ctx.lineTo(s.x, s.y)
  })
  if (close) ctx.closePath()
}

const planeOutline = (phi: number): { x: number; y: number }[] => [
  project(inPlane(phi, -HALF_WIDTH, -HALF_HEIGHT)),
  project(inPlane(phi, HALF_WIDTH, -HALF_HEIGHT)),
  project(inPlane(phi, HALF_WIDTH, HALF_HEIGHT)),
  project(inPlane(phi, -HALF_WIDTH, HALF_HEIGHT)),
]

// A shallow tree, drawn once in plane coordinates and carried by every plane.
const GLYPH: readonly Polygon[] = equilateralFan({ depth: 3, alpha: 0.75 }).map((s) =>
  s.polygon.map((v) => ({ x: (v.x - 0.1) * 0.9, y: (v.y - 0.55) * 0.9 })),
)

export const CODA_BOX = { minX: -2.1, minY: -1.35, maxX: 2.4, maxY: 1.5 }

export const drawCodaPlate = (p: Painter, t: number): void => {
  const { ctx } = p
  const shown = Math.max(1, Math.ceil(t * PLANES))
  const activePhi = t * Math.PI * 0.92

  // The pencil of planes, oldest first so the active one draws on top.
  for (let k = 0; k < shown; k++) {
    const phi = (k / PLANES) * Math.PI
    tracePath(p, planeOutline(phi), true)
    ctx.strokeStyle = PENCIL
    ctx.lineWidth = 1 / p.dpr
    ctx.stroke()
  }

  // The active plane: filled, carrying the flat construction.
  tracePath(p, planeOutline(activePhi), true)
  ctx.fillStyle = WASH_FLAT
  ctx.globalAlpha = ctx.globalAlpha * 0.85
  ctx.fill()
  ctx.globalAlpha = ctx.globalAlpha / 0.85
  ctx.strokeStyle = INK
  ctx.lineWidth = 1 / p.dpr
  ctx.stroke()

  for (const poly of GLYPH) {
    tracePath(
      p,
      poly.map((v) => project(inPlane(activePhi, v.x, v.y))),
      true,
    )
    ctx.strokeStyle = WASH_EDGE
    ctx.lineWidth = 1 / p.dpr
    ctx.stroke()
  }

  // The hinge: the needle parked on the one line every plane shares.
  const hinge = [project({ x: 0, y: -HALF_HEIGHT, z: 0 }), project({ x: 0, y: HALF_HEIGHT, z: 0 })]
  tracePath(p, hinge, false)
  ctx.strokeStyle = RED
  ctx.lineWidth = 2 / p.dpr
  ctx.lineCap = 'round'
  ctx.stroke()

  // Direction sphere, filling in as the fan covers headings.
  const center: P3 = { x: 1.85, y: -0.75, z: 0 }
  const R = 0.32
  const circle: { x: number; y: number }[] = []
  for (let i = 0; i <= 48; i++) {
    const a = (2 * Math.PI * i) / 48
    circle.push(project({ x: center.x + R * Math.cos(a), y: center.y + R * Math.sin(a), z: 0 }))
  }
  tracePath(p, circle, true)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1 / p.dpr
  ctx.stroke()

  for (let k = 0; k < shown; k++) {
    const phi = (k / PLANES) * Math.PI
    const arc: { x: number; y: number }[] = []
    for (let i = 0; i <= 40; i++) {
      const psi = (2 * Math.PI * i) / 40
      const d = inPlane(phi, Math.cos(psi) * R, Math.sin(psi) * R)
      arc.push(project({ x: center.x + d.x, y: center.y + d.y, z: d.z }))
    }
    tracePath(p, arc, true)
    ctx.strokeStyle = WASH_EDGE
    ctx.lineWidth = 1 / p.dpr
    ctx.stroke()
  }
}

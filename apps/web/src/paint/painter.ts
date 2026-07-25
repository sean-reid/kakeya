import type { Needle, Polygon, Vec } from '@kakeya/geometry'
import { needleB, signedArea } from '@kakeya/geometry'
import { worldToScreen, type Transform } from '../engine/camera'
import { INK, PENCIL, RED, WASH, WASH_EDGE } from './styles'

/**
 * All drawing happens in screen space: world points go through the camera
 * transform per vertex, and stroke widths are set in physical pixels so
 * hairlines stay hairlines at any zoom. The painter never decides where
 * anything is - it renders what the geometry package computed.
 */
export interface Painter {
  readonly ctx: CanvasRenderingContext2D
  readonly transform: Transform
  /** Device pixel ratio the context is scaled by. */
  readonly dpr: number
}

const tracePolygon = (p: Painter, poly: Polygon): void => {
  const { ctx, transform } = p
  ctx.beginPath()
  poly.forEach((v, i) => {
    const s = worldToScreen(transform, v.x, v.y)
    if (i === 0) ctx.moveTo(s.x, s.y)
    else ctx.lineTo(s.x, s.y)
  })
  ctx.closePath()
}

const hairline = (p: Painter): number => 1 / p.dpr

export const drawWashPolygon = (p: Painter, poly: Polygon): void => {
  tracePolygon(p, poly)
  p.ctx.fillStyle = WASH
  p.ctx.fill()
  p.ctx.strokeStyle = WASH_EDGE
  p.ctx.lineWidth = hairline(p)
  p.ctx.stroke()
}

/**
 * The union silhouette, filled FLAT: all polygons traced into one path and
 * filled once, so heavy overlap cannot darken or muddy the figure. This is
 * what makes the set read as one clean spiky region instead of a tangle.
 */
export const drawFlatUnion = (p: Painter, polys: readonly Polygon[], fill: string): void => {
  const { ctx, transform } = p
  ctx.beginPath()
  for (const poly of polys) {
    // Trace every polygon with one winding: mixed windings cancel under the
    // nonzero rule and cut holes where shapes overlap.
    const pts = signedArea(poly) < 0 ? [...poly].reverse() : poly
    pts.forEach((v, i) => {
      const s = worldToScreen(transform, v.x, v.y)
      if (i === 0) ctx.moveTo(s.x, s.y)
      else ctx.lineTo(s.x, s.y)
    })
    ctx.closePath()
  }
  ctx.fillStyle = fill
  ctx.fill('nonzero')
}

export const drawEdges = (p: Painter, polys: readonly Polygon[], stroke: string): void => {
  const { ctx, transform } = p
  // One path, one stroke: per-polygon strokes cost a rasterization pass each.
  ctx.beginPath()
  for (const poly of polys) {
    poly.forEach((v, i) => {
      const s = worldToScreen(transform, v.x, v.y)
      if (i === 0) ctx.moveTo(s.x, s.y)
      else ctx.lineTo(s.x, s.y)
    })
    ctx.closePath()
  }
  ctx.strokeStyle = stroke
  ctx.lineWidth = hairline(p)
  ctx.stroke()
}

export const drawInkPolygon = (p: Painter, poly: Polygon): void => {
  tracePolygon(p, poly)
  p.ctx.strokeStyle = INK
  p.ctx.lineWidth = hairline(p)
  p.ctx.stroke()
}

export const drawPencilSegment = (p: Painter, a: Vec, b: Vec): void => {
  const { ctx, transform } = p
  const sa = worldToScreen(transform, a.x, a.y)
  const sb = worldToScreen(transform, b.x, b.y)
  ctx.beginPath()
  ctx.moveTo(sa.x, sa.y)
  ctx.lineTo(sb.x, sb.y)
  ctx.strokeStyle = PENCIL
  ctx.lineWidth = hairline(p)
  ctx.stroke()
}

export const drawNeedle = (p: Painter, n: Needle): void => {
  const { ctx, transform } = p
  const b = needleB(n)
  const sa = worldToScreen(transform, n.a.x, n.a.y)
  const sb = worldToScreen(transform, b.x, b.y)
  ctx.beginPath()
  ctx.moveTo(sa.x, sa.y)
  ctx.lineTo(sb.x, sb.y)
  ctx.strokeStyle = RED
  ctx.lineWidth = hairline(p) * 2
  ctx.lineCap = 'round'
  ctx.stroke()
}

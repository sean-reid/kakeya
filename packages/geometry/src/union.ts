import type { Polygon } from './polygon'
import { strictlyInside } from './polygon'

export interface Box {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export const boundingBox = (polys: readonly Polygon[]): Box => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const poly of polys) {
    for (const p of poly) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Union area by deterministic grid sampling: count cells whose center lies in
 * the union. Independent oracle for the exact clipping computation - the two
 * must agree before an area number is shown on the site. Error is O(perimeter
 * * cellSize), so callers pick cellSize against the figures' scale.
 */
export const gridUnionArea = (polys: readonly Polygon[], cellSize: number): number => {
  if (polys.length === 0) return 0
  const box = boundingBox(polys)
  const cols = Math.max(1, Math.ceil((box.maxX - box.minX) / cellSize))
  const rows = Math.max(1, Math.ceil((box.maxY - box.minY) / cellSize))
  let hits = 0
  for (let j = 0; j < rows; j++) {
    const y = box.minY + (j + 0.5) * cellSize
    for (let i = 0; i < cols; i++) {
      const x = box.minX + (i + 0.5) * cellSize
      for (const poly of polys) {
        if (strictlyInside(poly, { x, y })) {
          hits++
          break
        }
      }
    }
  }
  return hits * cellSize * cellSize
}

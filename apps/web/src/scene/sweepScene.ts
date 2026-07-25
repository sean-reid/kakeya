import {
  boundingBox,
  compile,
  evaluate,
  kakeyaSweep,
  sweepPaths,
  sweepPolygons,
  type CompiledProgram,
  type KakeyaSweep,
  type Needle,
} from '@kakeya/geometry'
import {
  camera,
  cameraTransform,
  frameBox,
  stepCamera,
  type Camera,
  type Viewport,
} from '../engine/camera'
import { buildTimeline, progressToDistance, type Timeline } from '../engine/timeline'
import {
  drawEdges,
  drawFlatUnion,
  drawNeedle,
  drawPencilSegment,
  type Painter,
} from '../paint/painter'
import { PAPER, WASH_EDGE, WASH_FLAT } from '../paint/styles'

/**
 * The living plate: the sweep set drawn in wash and pencil, the needle in
 * red, a camera that frames the tree and follows nothing yet. The story and
 * the playground will both drive this scene through setProgress.
 */
export interface SweepScene {
  setProgress(u: number): void
  /** Advance springs and repaint. */
  frame(ctx: CanvasRenderingContext2D, vp: Viewport, dpr: number, dt: number): void
  readonly sweep: KakeyaSweep
}

export interface SweepSceneOptions {
  readonly depth?: number
  readonly alpha?: number
  readonly joinExcursion?: number
  /** Excursion lines stay hidden unless a beat asks for them. */
  readonly showPaths?: boolean
}

export const createSweepScene = (options: SweepSceneOptions = {}): SweepScene => {
  const { depth = 5, alpha = 0.8, joinExcursion = 50, showPaths = false } = options
  const sweep = kakeyaSweep({ depth, alpha, joinExcursion })
  const compiled: CompiledProgram = compile({ start: sweep.start, moves: [...sweep.moves] })
  const timeline: Timeline = buildTimeline(compiled)
  const polygons = sweepPolygons(sweep)
  const paths = sweepPaths(sweep)
  const treeBox = boundingBox(sweep.slices.map((s) => s.polygon))

  let progress = 0
  let cam: Camera | null = null

  return {
    sweep,
    setProgress(u: number) {
      progress = Math.min(Math.max(u, 0), 1)
    },
    frame(ctx, vp, dpr, dt) {
      const target = frameBox(treeBox.minX, treeBox.minY, treeBox.maxX, treeBox.maxY, vp, 0.16)
      cam = cam === null ? camera(target) : stepCamera(cam, target, dt)

      ctx.fillStyle = PAPER
      ctx.fillRect(0, 0, vp.width, vp.height)

      const painter: Painter = { ctx, transform: cameraTransform(cam, vp), dpr }
      if (showPaths) {
        for (const [a, b] of paths) drawPencilSegment(painter, a, b)
      }
      // Edges first, opaque fill second: interior strokes vanish under the
      // fill and only the exterior outline survives.
      drawEdges(painter, polygons, WASH_EDGE)
      drawFlatUnion(painter, polygons, WASH_FLAT)

      const needle: Needle = evaluate(compiled, progressToDistance(timeline, progress))
      drawNeedle(painter, needle)
    },
  }
}

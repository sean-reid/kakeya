import {
  AREA_TABLE,
  boundingBox,
  compile,
  deltoidArea,
  deltoidNeedle,
  deltoidPolygon,
  dir,
  EQUILATERAL_AREA,
  equilateralFan,
  evaluate,
  kakeyaSweep,
  needleB,
  UNIT_NEEDLE_R,
  vec,
  type CompiledProgram,
  type Needle,
  type PerronSlice,
  type Polygon,
  type SweepSegment,
} from '@kakeya/geometry'
import {
  camera,
  cameraTransform,
  frameBox,
  cameraSettled,
  stepCamera,
  type Camera,
  type CameraTarget,
  type Viewport,
} from '../engine/camera'
import { buildTimeline, progressToDistance, type Timeline } from '../engine/timeline'
import {
  drawEdges,
  drawFlatUnion,
  drawInkPolygon,
  drawNeedle,
  drawPencilSegment,
  drawWashPolygon,
  type Painter,
} from '../paint/painter'
import { PAPER, RED_SOFT, WASH_EDGE, WASH_FLAT } from '../paint/styles'
import { BEATS, beatAt } from './beats'
import { CODA_BOX, drawCodaPlate } from './codaPlate'

/**
 * One scene renders every beat: the geometry is precomputed once, the camera
 * springs persist across beats so cuts glide instead of jumping, and the
 * only inputs are global progress and the clock.
 */
export interface StoryFrame {
  /** Text for the running area counter, empty when hidden. */
  readonly counter: string
  readonly beatIndex: number
}

export interface StoryScene {
  setProgress(u: number): void
  frame(ctx: CanvasRenderingContext2D, vp: Viewport, dpr: number, dt: number): StoryFrame
  scale(): number
  /** True once the camera has arrived; nothing will change until input does. */
  settled(): boolean
}

const STORY_DEPTH = 5
// Short on purpose: the detours are PART of the set and must fit the frame.
// Their cost scales like 1/length - the copy and playground make that point.
const EXCURSION = 2
// Depth 0 is the uncut triangle; deeper alphas come from the measured table,
// so the drawn figure and the shown number can never describe different sets.
const alphaFor = (depth: number): number => (depth === 0 ? 0.75 : AREA_TABLE[depth - 1]!.alpha)

const ease = (t: number): number => t * t * (3 - 2 * t)

interface DepthStep {
  readonly slices: readonly PerronSlice[]
  /** Offset of each slice's parent at the previous depth, for the slide-in. */
  readonly parentOffsets: readonly number[]
  readonly area: number
}

const translatePolygon = (poly: Polygon, dx: number): Polygon => poly.map((p) => vec(p.x + dx, p.y))

export const createStoryScene = (reduced: boolean): StoryScene => {
  // Construction beat: fans at depths 0..5, each child remembering where its
  // parent sat so the split-and-slide reads as continuous motion.
  const fans: DepthStep[] = []
  for (let d = 0; d <= STORY_DEPTH; d++) {
    const slices = equilateralFan({ depth: d, alpha: alphaFor(d) })
    const parent = d === 0 ? null : fans[d - 1]!
    fans.push({
      slices,
      parentOffsets: slices.map((_, j) =>
        parent === null ? 0 : parent.slices[Math.floor(j / 2)]!.offset,
      ),
      area: d === 0 ? EQUILATERAL_AREA : AREA_TABLE[d - 1]!.fanArea,
    })
  }
  const fanBoxes = fans.map((f) => boundingBox(f.slices.map((s) => s.polygon)))
  const fanBox = {
    minX: Math.min(...fanBoxes.map((b) => b.minX)),
    minY: Math.min(...fanBoxes.map((b) => b.minY)),
    maxX: Math.max(...fanBoxes.map((b) => b.maxX)),
    maxY: Math.max(...fanBoxes.map((b) => b.maxY)),
  }

  // Sweep beats: the full apparatus at story depth.
  const sweep = kakeyaSweep({
    depth: STORY_DEPTH,
    alpha: alphaFor(STORY_DEPTH),
    joinExcursion: EXCURSION,
  })
  const sweepCompiled: CompiledProgram = compile({ start: sweep.start, moves: [...sweep.moves] })
  const sweepTimeline: Timeline = buildTimeline(sweepCompiled)
  const sweepPolys = sweep.slices.map((s) => s.polygon)
  // The drawn set is slices AND join sectors; the travel lines ride along.
  const sweepSetPolys = [...sweepPolys, ...sweep.joins.flatMap((j) => [...j.sectors])]
  const sweepPaths = sweep.joins.flatMap((j) => [...j.paths])
  const coreBox = boundingBox([...sweepSetPolys, ...sweepPaths.map(([a, b]) => [a, b] as const)])
  const sweepRow = AREA_TABLE[STORY_DEPTH - 1]!

  // The join beat demonstrates ONE excursion at full length: a second sweep
  // built with a far excursion (the slices are identical - length only
  // changes the detours), from which we play a single mid-fan join while the
  // camera rides along. The beats after it show the compact short-join set.
  const DEMO_EXCURSION = 50
  const demoSweep = kakeyaSweep({
    depth: STORY_DEPTH,
    alpha: alphaFor(STORY_DEPTH),
    joinExcursion: DEMO_EXCURSION,
  })
  const demoCompiled = compile({ start: demoSweep.start, moves: [...demoSweep.moves] })
  const demoSegments = demoSweep.segments.filter(
    (s): s is Extract<SweepSegment, { kind: 'join' }> => s.kind === 'join',
  )
  // The middle join of the second fan: typical tilt, far from fan boundaries.
  const SLICES_PER_FAN = 2 ** STORY_DEPTH
  const joinSegment = demoSegments[SLICES_PER_FAN + SLICES_PER_FAN / 2]!
  const joinRange = {
    from: demoCompiled.offsets[joinSegment.moveStart]!,
    to: demoCompiled.offsets[joinSegment.moveEnd]!,
  }
  const demoJoin = demoSweep.joins[joinSegment.join]!

  // Deltoid beat.
  const deltoid = deltoidPolygon(UNIT_NEEDLE_R, 1024)
  const deltoidBox = boundingBox([deltoid])

  let progress = 0
  let cam: Camera | null = null
  let lastScale = 1
  let lastTarget: CameraTarget | null = null

  // The label card occupies the bottom band of the screen; lift the figure
  // above it and back the zoom off slightly so art and text never fight.
  // On narrow screens the card sits in the bottom band, so the figure lifts
  // above it; on wide screens the card docks into the left margin instead
  // and the figure needs only a gentle nudge.
  const biasForCard = (target: CameraTarget, vp: Viewport): CameraTarget => {
    const narrow = vp.width < 900
    return {
      x: target.x,
      y: target.y - ((narrow ? 0.13 : 0.05) * vp.height) / target.zoom,
      zoom: target.zoom * (narrow ? 0.82 : 0.92),
    }
  }

  const needleBoxTarget = (n: Needle, vp: Viewport): CameraTarget => {
    // A unit of padding past the needle keeps it clear of the masthead
    // corner at the excursion's far end.
    const b = needleB(n)
    return frameBox(
      Math.min(coreBox.minX, n.a.x - 1, b.x - 1),
      Math.min(coreBox.minY, n.a.y - 1, b.y - 1),
      Math.max(coreBox.maxX, n.a.x + 1, b.x + 1),
      Math.max(coreBox.maxY, n.a.y + 1, b.y + 1),
      vp,
      0.16,
    )
  }

  return {
    setProgress(u: number) {
      progress = Math.min(Math.max(u, 0), 1)
    },
    scale() {
      return lastScale
    },
    settled() {
      return cam !== null && lastTarget !== null && cameraSettled(cam, lastTarget)
    },
    frame(ctx, vp, dpr, dt): StoryFrame {
      const { index, local } = beatAt(progress)

      // Dissolve between beats: through the opening stretch of each beat,
      // the previous beat's final image fades away underneath this one.
      const FADE = 0.15
      const plan = planBeat(index, local, vp)
      let target = plan.target
      let counter = plan.counter
      let paint: (p: Painter) => void = plan.draw
      if (index > 0 && local < FADE && !reduced) {
        // Sequential, never simultaneous: the old scene fades fully to paper
        // in the first half of the window, the new one rises from paper in
        // the second. No double exposure.
        const k = local / FADE
        if (k < 0.5) {
          const prev = planBeat(index - 1, 1, vp)
          target = prev.target
          counter = prev.counter
          const a = 1 - ease(k * 2)
          paint = (p) => withAlpha(p, a, prev.draw)
        } else {
          const a = ease((k - 0.5) * 2)
          const current = plan.draw
          paint = (p) => withAlpha(p, a, current)
        }
      }

      target = biasForCard(target, vp)
      cam = cam === null ? camera(target) : stepCamera(cam, target, reduced ? 10 : dt)
      lastTarget = target

      ctx.fillStyle = PAPER
      ctx.fillRect(0, 0, vp.width, vp.height)
      const transform = cameraTransform(cam, vp)
      lastScale = transform.scale
      paint({ ctx, transform, dpr })

      return { counter, beatIndex: index }
    },
  }

  interface BeatPlan {
    readonly target: CameraTarget
    readonly counter: string
    readonly draw: (p: Painter) => void
  }

  function withAlpha(p: Painter, alpha: number, draw: (p: Painter) => void): void {
    const before = p.ctx.globalAlpha
    p.ctx.globalAlpha = before * alpha
    draw(p)
    p.ctx.globalAlpha = before
  }

  // Reduced motion means no autonomous or eased movement - but scrubbing
  // that tracks the user's own scrolling stays, linear and direct.
  function planBeat(index: number, local: number, vp: Viewport): BeatPlan {
    const beat = BEATS[index]!
    const t = reduced ? local : ease(local)

    let target: CameraTarget = frameBox(-1.3, -0.9, 1.3, 0.9, vp, 0.15)
    let counter = ''
    let draw: (p: Painter) => void = () => {}

    switch (beat.id) {
      case 'needle': {
        target = frameBox(-1.1, -0.55, 1.1, 0.55, vp, 0.15)
        draw = (p) => drawNeedle(p, { a: vec(-0.5, 0), theta: 0 })
        break
      }
      case 'halfdisc':
      case 'question': {
        const swept = beat.id === 'question' ? Math.PI : t * Math.PI
        target = frameBox(-1.15, -0.2, 1.15, 1.1, vp, 0.15)
        draw = (p) => {
          const fanPts = [vec(0, 0)]
          const steps = Math.max(2, Math.ceil((swept / Math.PI) * 64))
          for (let i = 0; i <= steps; i++) {
            fanPts.push(dir((swept * i) / steps))
          }
          const base = p.ctx.globalAlpha
          p.ctx.globalAlpha = base * (beat.id === 'question' ? 0.35 : 1)
          drawFlatUnion(p, [fanPts], RED_SOFT)
          drawInkPolygon(p, fanPts)
          p.ctx.globalAlpha = base
          drawNeedle(p, { a: vec(0, 0), theta: swept })
        }
        if (beat.id === 'halfdisc') counter = (swept / 2).toFixed(4)
        break
      }
      case 'deltoid': {
        target = frameBox(
          deltoidBox.minX,
          deltoidBox.minY,
          deltoidBox.maxX,
          deltoidBox.maxY,
          vp,
          0.2,
        )
        const dn = deltoidNeedle(UNIT_NEEDLE_R, t * 2 * Math.PI)
        draw = (p) => {
          drawFlatUnion(p, [deltoid], WASH_FLAT)
          drawInkPolygon(p, deltoid)
          drawNeedle(p, { a: dn.a, theta: Math.atan2(dn.b.y - dn.a.y, dn.b.x - dn.a.x) })
        }
        counter = deltoidArea(UNIT_NEEDLE_R).toFixed(4)
        break
      }
      case 'besicovitch': {
        target = frameBox(fanBox.minX, fanBox.minY, fanBox.maxX, fanBox.maxY, vp, 0.18)
        draw = (p) => {
          drawFlatUnion(p, [fans[0]!.slices[0]!.polygon], WASH_FLAT)
          drawInkPolygon(p, fans[0]!.slices[0]!.polygon)
        }
        counter = EQUILATERAL_AREA.toFixed(4)
        break
      }
      case 'construction': {
        const seg = Math.min(t * STORY_DEPTH, STORY_DEPTH - 1e-9)
        const d = Math.floor(seg)
        const box = fanBoxes[d + 1]!
        target = frameBox(box.minX, box.minY, box.maxX, box.maxY, vp, 0.18)
        const f = ease(seg - d)
        const step = fans[d + 1]!
        draw = (p) => {
          const polys = step.slices.map((s, j) =>
            translatePolygon(s.polygon, (step.parentOffsets[j]! - s.offset) * (1 - f)),
          )
          // Opaque silhouette, always; the slice anatomy fades in only
          // while the pieces are actually sliding.
          drawEdges(p, polys, WASH_EDGE)
          drawFlatUnion(p, polys, WASH_FLAT)
          const anatomy = Math.sin(Math.PI * f)
          if (anatomy > 0.02) {
            p.ctx.globalAlpha = anatomy * 0.6
            for (const poly of polys) drawWashPolygon(p, poly)
            p.ctx.globalAlpha = 1
          }
        }
        const area = fans[d]!.area + (step.area - fans[d]!.area) * f
        counter = area.toFixed(4)
        break
      }
      case 'join': {
        const s = joinRange.from + (joinRange.to - joinRange.from) * t
        const n = evaluate(demoCompiled, s)
        target = needleBoxTarget(n, vp)
        // Bare trees and ONE long demonstration detour; the short joins make
        // their first appearance in the next beat.
        draw = (p) => {
          for (const [a, b] of demoJoin.paths) drawPencilSegment(p, a, b)
          drawEdges(p, sweepPolys, WASH_EDGE)
          drawFlatUnion(p, sweepPolys, WASH_FLAT)
          drawNeedle(p, n)
        }
        break
      }
      case 'sweep': {
        const n = evaluate(sweepCompiled, progressToDistance(sweepTimeline, t))
        target = frameBox(coreBox.minX, coreBox.minY, coreBox.maxX, coreBox.maxY, vp, 0.16)
        draw = (p) => {
          for (const [a, b] of sweepPaths) drawPencilSegment(p, a, b)
          drawEdges(p, sweepSetPolys, WASH_EDGE)
          drawFlatUnion(p, sweepSetPolys, WASH_FLAT)
          drawNeedle(p, n)
        }
        counter = `${sweepRow.sweepArea.toFixed(4)} + ${sweep.joinArea.toFixed(4)} for the detours`
        break
      }
      case 'solved': {
        target = frameBox(coreBox.minX, coreBox.minY, coreBox.maxX, coreBox.maxY, vp, 0.16)
        draw = (p) => {
          for (const [a, b] of sweepPaths) drawPencilSegment(p, a, b)
          drawEdges(p, sweepSetPolys, WASH_EDGE)
          drawFlatUnion(p, sweepSetPolys, WASH_FLAT)
        }
        break
      }
      case 'coda': {
        target = frameBox(CODA_BOX.minX, CODA_BOX.minY, CODA_BOX.maxX, CODA_BOX.maxY, vp, 0.14)
        draw = (p) => drawCodaPlate(p, t)
        break
      }
    }

    return { target, counter, draw }
  }
}

import {
  AREA_TABLE,
  boundingBox,
  compile,
  deltoidNeedle,
  deltoidPolygon,
  dir,
  evaluate,
  kakeyaSweep,
  perronTree,
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
}

const STORY_ALPHAS = [0.75, 0.65, 0.7, 0.75, 0.8, 0.8] as const
const STORY_DEPTH = 5
const EXCURSION = 50
const FAN_HALF = 1 / Math.sqrt(3)
const TRIANGLE_AREA = 1 / Math.sqrt(3)

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
    const slices = perronTree(vec(0, 1), -FAN_HALF, FAN_HALF, {
      depth: d,
      alpha: STORY_ALPHAS[d]!,
    })
    const parent = d === 0 ? null : fans[d - 1]!
    fans.push({
      slices,
      parentOffsets: slices.map((_, j) =>
        parent === null ? 0 : parent.slices[Math.floor(j / 2)]!.offset,
      ),
      area: d === 0 ? TRIANGLE_AREA : AREA_TABLE[d - 1]!.fanArea,
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
    alpha: STORY_ALPHAS[STORY_DEPTH]!,
    joinExcursion: EXCURSION,
  })
  const sweepCompiled: CompiledProgram = compile({ start: sweep.start, moves: [...sweep.moves] })
  const sweepTimeline: Timeline = buildTimeline(sweepCompiled)
  const sweepPolys = sweep.slices.map((s) => s.polygon)
  const coreBox = boundingBox(sweepPolys)
  const sweepRow = AREA_TABLE[STORY_DEPTH - 1]!

  // The join beat plays one specific excursion: a mid-figure join, well away
  // from the fan boundaries so the tilt is small and typical.
  const joinSegments = sweep.segments.filter(
    (s): s is Extract<SweepSegment, { kind: 'join' }> => s.kind === 'join',
  )
  const joinSegment = joinSegments[Math.floor(2 ** STORY_DEPTH * 1.5)]!
  const joinRange = {
    from: sweepCompiled.offsets[joinSegment.moveStart]!,
    to: sweepCompiled.offsets[joinSegment.moveEnd]!,
  }
  const activeJoin = sweep.joins[joinSegment.join]!

  // Deltoid beat.
  const deltoid = deltoidPolygon(UNIT_NEEDLE_R, 1024)
  const deltoidBox = boundingBox([deltoid])

  let progress = 0
  let cam: Camera | null = null
  let lastScale = 1

  const needleBoxTarget = (n: Needle, vp: Viewport): CameraTarget => {
    const b = { x: n.a.x + dir(n.theta).x, y: n.a.y + dir(n.theta).y }
    return frameBox(
      Math.min(coreBox.minX, n.a.x, b.x),
      Math.min(coreBox.minY, n.a.y, b.y),
      Math.max(coreBox.maxX, n.a.x, b.x),
      Math.max(coreBox.maxY, n.a.y, b.y),
      vp,
      0.18,
    )
  }

  return {
    setProgress(u: number) {
      progress = Math.min(Math.max(u, 0), 1)
    },
    scale() {
      return lastScale
    },
    frame(ctx, vp, dpr, dt): StoryFrame {
      // Reduced motion means no autonomous or eased movement - but scrubbing
      // that tracks the user's own scrolling stays, linear and direct.
      const { index, local } = beatAt(progress)
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
            p.ctx.globalAlpha = beat.id === 'question' ? 0.35 : 1
            drawFlatUnion(p, [fanPts], RED_SOFT)
            drawInkPolygon(p, fanPts)
            p.ctx.globalAlpha = 1
            drawNeedle(p, { a: vec(0, 0), theta: swept })
          }
          if (beat.id === 'halfdisc') counter = `${((swept / Math.PI) * 1.5708).toFixed(4)}`
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
          counter = '0.3927'
          break
        }
        case 'besicovitch': {
          target = frameBox(fanBox.minX, fanBox.minY, fanBox.maxX, fanBox.maxY, vp, 0.18)
          draw = (p) => {
            drawFlatUnion(p, [fans[0]!.slices[0]!.polygon], WASH_FLAT)
            drawInkPolygon(p, fans[0]!.slices[0]!.polygon)
          }
          counter = TRIANGLE_AREA.toFixed(4)
          break
        }
        case 'construction': {
          target = frameBox(fanBox.minX, fanBox.minY, fanBox.maxX, fanBox.maxY, vp, 0.18)
          const seg = Math.min(t * STORY_DEPTH, STORY_DEPTH - 1e-9)
          const d = Math.floor(seg)
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
          const n = evaluate(sweepCompiled, s)
          target = needleBoxTarget(n, vp)
          draw = (p) => {
            for (const [a, b] of activeJoin.paths) drawPencilSegment(p, a, b)
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
            drawEdges(p, sweepPolys, WASH_EDGE)
            drawFlatUnion(p, sweepPolys, WASH_FLAT)
            drawNeedle(p, n)
          }
          counter = `${sweepRow.sweepArea.toFixed(4)} + ${(
            (sweepRow.joinArea * 100) /
            EXCURSION
          ).toFixed(4)} for the detours`
          break
        }
        case 'solved':
        case 'coda': {
          target = frameBox(coreBox.minX, coreBox.minY, coreBox.maxX, coreBox.maxY, vp, 0.16)
          draw = (p) => {
            drawEdges(p, sweepPolys, WASH_EDGE)
            drawFlatUnion(p, sweepPolys, WASH_FLAT)
          }
          break
        }
      }

      cam = cam === null ? camera(target) : stepCamera(cam, target, reduced ? 10 : dt)

      ctx.fillStyle = PAPER
      ctx.fillRect(0, 0, vp.width, vp.height)
      const transform = cameraTransform(cam, vp)
      lastScale = transform.scale
      draw({ ctx, transform, dpr })

      return { counter, beatIndex: index }
    },
  }
}

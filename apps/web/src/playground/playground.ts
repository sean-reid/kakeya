import {
  AREA_TABLE,
  boundingBox,
  compile,
  evaluate,
  kakeyaSweep,
  type CompiledProgram,
  type KakeyaSweep,
  type Polygon,
} from '@kakeya/geometry'
import {
  camera,
  cameraSettled,
  cameraTransform,
  frameBox,
  stepCamera,
  type Camera,
  type CameraTarget,
  type Viewport,
} from '../engine/camera'
import {
  buildTimeline,
  distanceToProgress,
  progressToDistance,
  type Timeline,
} from '../engine/timeline'
import {
  drawEdges,
  drawFlatUnion,
  drawNeedle,
  drawPencilSegment,
  type Painter,
} from '../paint/painter'
import { PAPER, WASH_EDGE, WASH_FLAT } from '../paint/styles'

/**
 * The instrument. Every control drives the same verified machinery the story
 * uses: depth and detour length rebuild the construction (a couple of
 * milliseconds), the dial and playhead move the needle along the exact
 * motion program, and the area line always shows the measured tree area
 * plus the exact detour cost of what is currently drawn.
 */
interface State {
  depth: number
  excursion: number
  /** Timeline progress in [0, 1]. */
  u: number
  playing: boolean
  speed: number
  /** Seek destination for the direction dial, or null. */
  seekTo: number | null
  /** Playback direction: the needle retraces at the ends, never teleports. */
  forward: boolean
}

interface Built {
  sweep: KakeyaSweep
  compiled: CompiledProgram
  timeline: Timeline
  setPolys: Polygon[]
  paths: (readonly [{ x: number; y: number }, { x: number; y: number }])[]
  box: { minX: number; minY: number; maxX: number; maxY: number }
  /** Rotation segments: needle theta span per program span, for the dial. */
  turns: { thetaFrom: number; thetaTo: number; sFrom: number; sTo: number }[]
}

const build = (depth: number, excursion: number): Built => {
  const sweep = kakeyaSweep({
    depth,
    alpha: AREA_TABLE[depth - 1]!.alpha,
    joinExcursion: excursion,
  })
  const compiled = compile({ start: sweep.start, moves: [...sweep.moves] })
  const timeline = buildTimeline(compiled)
  const setPolys = [
    ...sweep.slices.map((s) => s.polygon),
    ...sweep.joins.flatMap((j) => [...j.sectors]),
  ]
  const paths = sweep.joins.flatMap((j) => [...j.paths])
  const box = boundingBox([...setPolys, ...paths.map(([a, b]) => [a, b] as const)])
  const turns = sweep.segments
    .filter((seg) => seg.kind === 'rotate')
    .map((seg) => ({
      thetaFrom: compiled.states[seg.moveStart]!.theta,
      thetaTo: compiled.states[seg.moveEnd]!.theta,
      sFrom: compiled.offsets[seg.moveStart]!,
      sTo: compiled.offsets[seg.moveEnd]!,
    }))
  return { sweep, compiled, timeline, setPolys, paths, box, turns }
}

/** Program distance where the needle points in direction tau (mod pi). */
const distanceForDirection = (built: Built, tau: number): number => {
  const theta0 = built.turns[0]!.thetaFrom
  const absolute = theta0 + ((((tau - theta0) % Math.PI) + Math.PI) % Math.PI)
  for (const turn of built.turns) {
    if (absolute >= turn.thetaFrom - 1e-9 && absolute <= turn.thetaTo + 1e-9) {
      const f = (absolute - turn.thetaFrom) / (turn.thetaTo - turn.thetaFrom || 1)
      return turn.sFrom + (turn.sTo - turn.sFrom) * f
    }
  }
  return 0
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

const control = (label: string, input: HTMLElement, value?: HTMLElement): HTMLElement => {
  const wrap = el('div', 'control')
  const name = el('label', 'control-name')
  name.textContent = label
  name.append(input)
  wrap.append(name)
  if (value) {
    value.setAttribute('aria-hidden', 'true')
    wrap.append(value)
  }
  return wrap
}

export const mountPlayground = (host: HTMLElement, reduced: boolean): void => {
  host.innerHTML = ''
  const heading = el('h2')
  heading.id = 'playground-title'
  heading.textContent = 'Hold the needle yourself'
  host.setAttribute('aria-labelledby', 'playground-title')
  host.removeAttribute('aria-label')
  const canvas = el('canvas', 'playground-plate')
  canvas.setAttribute('aria-hidden', 'true')
  const areaLine = el('p', 'area-line')
  areaLine.setAttribute('data-testid', 'playground-area')
  areaLine.setAttribute('role', 'status')

  const state: State = {
    depth: 5,
    excursion: 8,
    u: 0,
    playing: false,
    speed: 1,
    seekTo: null,
    forward: true,
  }
  let built = build(state.depth, state.excursion)
  let dirty = true

  // Controls -----------------------------------------------------------
  const playBtn = el('button')
  playBtn.type = 'button'
  playBtn.dataset.testid = 'play'
  playBtn.textContent = 'Turn the needle'

  const dial = el('input') as HTMLInputElement
  dial.type = 'range'
  dial.min = '0'
  dial.max = '180'
  dial.step = '1'
  dial.value = '0'
  dial.dataset.testid = 'direction'
  const dialValue = el('span', 'control-value')

  const depthInput = el('input') as HTMLInputElement
  depthInput.type = 'range'
  depthInput.min = '1'
  depthInput.max = '8'
  depthInput.step = '1'
  depthInput.value = String(state.depth)
  depthInput.dataset.testid = 'depth'
  const depthValue = el('span', 'control-value')

  const excursionInput = el('input') as HTMLInputElement
  excursionInput.type = 'range'
  excursionInput.min = '0'
  excursionInput.max = '100'
  excursionInput.step = '1'
  excursionInput.value = '30'
  excursionInput.dataset.testid = 'excursion'
  const excursionValue = el('span', 'control-value')

  const speedInput = el('input') as HTMLInputElement
  speedInput.type = 'range'
  speedInput.min = '0.5'
  speedInput.max = '3'
  speedInput.step = '0.5'
  speedInput.value = '1'
  speedInput.dataset.testid = 'speed'
  const speedValue = el('span', 'control-value')
  speedValue.textContent = '1 times around in half a minute'

  const strip = el('div', 'controls')
  strip.append(
    playBtn,
    control('direction', dial, dialValue),
    control('cuts', depthInput, depthValue),
    control('detour length', excursionInput, excursionValue),
    control('pace', speedInput, speedValue),
  )

  const note = el('p', 'playground-note')
  note.textContent =
    'The needle only ever moves inside what is drawn. Stretch the detours and watch their cost fall; cut deeper and watch the tree shrink.'

  const inner = el('div', 'playground-inner')
  inner.append(heading, canvas, areaLine, strip, note)
  host.append(inner)

  // Wiring ---------------------------------------------------------------
  const sliderExcursion = (): number =>
    2 * Math.exp((Number(excursionInput.value) / 100) * Math.log(50))

  const speakValues = (): void => {
    depthInput.setAttribute('aria-valuetext', `${2 ** state.depth} slivers per fan`)
    excursionInput.setAttribute('aria-valuetext', `${state.excursion.toFixed(1)} needle lengths`)
    speedInput.setAttribute('aria-valuetext', `${speedInput.value} times`)
  }

  const updateAreaLine = (): void => {
    const row = AREA_TABLE[state.depth - 1]!
    areaLine.textContent =
      `tree ${row.sweepArea.toFixed(4)} + detours ${built.sweep.joinArea.toFixed(4)}. ` +
      `The plain half disc needs 1.5708.`
    excursionValue.textContent = `${state.excursion.toFixed(1)} needle lengths`
    depthValue.textContent = `${2 ** state.depth} slivers per fan`
    speakValues()
  }

  const rebuild = (): void => {
    built = build(state.depth, state.excursion)
    updateAreaLine()
    dirty = true
  }

  playBtn.addEventListener('click', () => {
    state.playing = !state.playing
    state.seekTo = null
    playBtn.textContent = state.playing ? 'Hold still' : 'Turn the needle'
    playBtn.classList.toggle('playing', state.playing)
    dirty = true
  })
  let dialHeld = false
  dial.addEventListener('pointerdown', () => {
    dialHeld = true
  })
  window.addEventListener('pointerup', () => {
    dialHeld = false
  })
  dial.addEventListener('input', () => {
    dialHeld = true
    window.setTimeout(() => {
      dialHeld = false
    }, 400)
    const tau = (Number(dial.value) * Math.PI) / 180
    state.seekTo = distanceToProgress(built.timeline, distanceForDirection(built, tau))
    state.playing = false
    playBtn.textContent = 'Turn the needle'
    dirty = true
  })
  depthInput.addEventListener('input', () => {
    state.depth = Number(depthInput.value)
    rebuild()
  })
  excursionInput.addEventListener('input', () => {
    state.excursion = sliderExcursion()
    rebuild()
  })
  speedInput.addEventListener('input', () => {
    state.speed = Number(speedInput.value)
    speedValue.textContent = `${speedInput.value} times around in half a minute`
    speakValues()
  })

  state.excursion = sliderExcursion()
  rebuild()
  const start = evaluate(built.compiled, 0)
  dial.value = String(Math.round(((((start.theta % Math.PI) + Math.PI) % Math.PI) * 180) / Math.PI))

  // Render loop ----------------------------------------------------------
  const ctx = canvas.getContext('2d')!
  let cam: Camera | null = null
  let lastTarget: CameraTarget | null = null
  let dpr = 1
  let visible = false
  let last = performance.now()

  const resize = (): void => {
    dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    dirty = true
  }
  resize()
  window.addEventListener('resize', resize)
  new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting)
      if (visible) dirty = true
    },
    { threshold: 0.05 },
  ).observe(canvas)

  const tick = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    requestAnimationFrame(tick)
    if (!visible) return

    if (state.playing) {
      const step = (dt * state.speed) / 30
      state.u += state.forward ? step : -step
      if (state.u >= 1) {
        state.u = 1
        state.forward = false
      } else if (state.u <= 0) {
        state.u = 0
        state.forward = true
      }
      dirty = true
    } else if (state.seekTo !== null) {
      const step = (dt * state.speed) / 10
      const delta = state.seekTo - state.u
      if (Math.abs(delta) <= step) {
        state.u = state.seekTo
        state.seekTo = null
      } else {
        state.u += Math.sign(delta) * step
      }
      dirty = true
    }

    const vp: Viewport = { width: canvas.clientWidth, height: canvas.clientHeight }
    const target = frameBox(
      built.box.minX,
      built.box.minY,
      built.box.maxX,
      built.box.maxY,
      vp,
      0.08,
    )
    cam = cam === null ? camera(target) : stepCamera(cam, target, reduced ? 10 : dt)
    const settledNow = lastTarget !== null && cameraSettled(cam, lastTarget)
    lastTarget = target
    // Everything below here, including the dial readout DOM writes, only
    // happens on frames that actually change.
    if (!dirty && settledNow) return
    dirty = false

    const s = progressToDistance(built.timeline, state.u)
    const n = evaluate(built.compiled, s)
    const degrees = Math.round(((((n.theta % Math.PI) + Math.PI) % Math.PI) * 180) / Math.PI)
    dialValue.textContent = `${degrees} degrees`
    dial.setAttribute('aria-valuetext', `${degrees} degrees`)
    if (!dialHeld) dial.value = String(degrees)

    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, vp.width, vp.height)
    const p: Painter = { ctx, transform: cameraTransform(cam, vp), dpr }

    for (const [a, b] of built.paths) drawPencilSegment(p, a, b)
    drawEdges(p, built.setPolys, WASH_EDGE)
    drawFlatUnion(p, built.setPolys, WASH_FLAT)

    drawNeedle(p, n)
  }
  requestAnimationFrame(tick)
}

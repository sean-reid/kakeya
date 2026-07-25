import { mountPlayground } from './playground/playground'
import { BEATS, totalHeights } from './story/beats'
import { createStoryScene } from './story/storyScene'
import './style.css'

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
document.documentElement.classList.toggle('reduced', reduced)

// Build the story sections from the beat definitions - one scroll section per
// beat, each with its sticky label card (which rides up and away with its
// section) and a hidden description of the picture. Two cards can never read
// as visible together: fade-out is fast and immediate, fade-in is delayed
// past it (see the .card transitions).
const story = document.getElementById('story')!
for (const beat of BEATS) {
  const section = document.createElement('section')
  section.className = 'beat'
  section.dataset.beat = beat.id
  section.style.height = `${beat.heights * 100}svh`

  const card = document.createElement('div')
  card.className = 'card'
  const p = document.createElement('p')
  p.textContent = beat.copy
  card.append(p)
  if (beat.note) {
    const note = document.createElement('p')
    note.className = 'note'
    note.textContent = beat.note
    card.append(note)
  }
  const hidden = document.createElement('p')
  hidden.className = 'visually-hidden'
  hidden.textContent = beat.describe
  section.append(card, hidden)
  story.append(section)
}

const canvas = document.getElementById('plate') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const counterEl = document.getElementById('counter')!
const scene = createStoryScene(reduced)
const sections = [...story.querySelectorAll<HTMLElement>('.beat')]

let dpr = 1
let needsDraw = true
const resize = (): void => {
  dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(canvas.clientWidth * dpr)
  canvas.height = Math.round(canvas.clientHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  needsDraw = true
}
resize()
window.addEventListener('resize', resize)

let pinned: number | null = null
let warpNext = false
let last = performance.now()
let activeIndex = -1

// Measured once per orientation: on iOS the live innerHeight changes as the
// toolbar collapses mid-scroll, and dividing by a moving number makes the
// whole animation lurch. The sections are sized in svh, which is just as
// fixed - but a rotation is a real change and re-measures.
let viewportAtLoad = window.innerHeight
window.addEventListener('orientationchange', () => {
  window.setTimeout(() => {
    viewportAtLoad = window.innerHeight
    needsDraw = true
  }, 300)
})
window
  .matchMedia('(prefers-reduced-motion: reduce)')
  .addEventListener('change', () => window.location.reload())

let lastU = -1

const tick = (now: number): void => {
  const dt = warpNext ? 5 : Math.min((now - last) / 1000, 0.1)
  const warped = warpNext
  warpNext = false
  last = now

  let u = pinned ?? lastU
  if (pinned === null) {
    const scrollable = story.offsetHeight - viewportAtLoad
    u = scrollable > 0 ? -story.getBoundingClientRect().top / scrollable : 0
    // Clamp BEFORE the idle comparison: past the story's end the raw
    // fraction keeps growing and would defeat the skip on every frame.
    u = Math.min(Math.max(u, 0), 1)
  }

  // Idle means idle: when nothing moved and the camera has arrived, paint
  // nothing. Full-canvas repaints at 60fps are pure battery drain.
  if (u === lastU && !warped && !needsDraw && scene.settled()) {
    requestAnimationFrame(tick)
    return
  }
  lastU = u
  needsDraw = false
  scene.setProgress(u)

  const frame = scene.frame(
    ctx,
    { width: canvas.clientWidth, height: canvas.clientHeight },
    dpr,
    dt,
  )

  counterEl.textContent = frame.counter
  counterEl.classList.toggle('visible', frame.counter !== '')

  if (frame.beatIndex !== activeIndex) {
    sections[activeIndex]?.classList.remove('active')
    sections[frame.beatIndex]?.classList.add('active')
    activeIndex = frame.beatIndex
  }

  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

// Deterministic hooks for the browser tests: pin progress, read the scale.
declare global {
  interface Window {
    __kakeya: {
      setProgress(u: number): void
      settle(): void
      scale(): number
    }
  }
}
window.__kakeya = {
  setProgress(u: number) {
    pinned = u
    scene.setProgress(u)
  },
  settle() {
    warpNext = true
  },
  scale() {
    return scene.scale() * dpr
  },
}

mountPlayground(document.getElementById('playground')!, reduced)

// The story container needs its full height even before sections lay out.
story.style.minHeight = `${totalHeights() * 100}svh`

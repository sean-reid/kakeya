import { createSweepScene } from './scene/sweepScene'
import './style.css'

const canvas = document.getElementById('plate') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const scene = createSweepScene()

let dpr = 1
const resize = (): void => {
  dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(canvas.clientWidth * dpr)
  canvas.height = Math.round(canvas.clientHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
resize()
window.addEventListener('resize', resize)

const LOOP_SECONDS = 40
let frozen = false
let last = performance.now()

const tick = (now: number): void => {
  const dt = Math.min((now - last) / 1000, 0.1)
  last = now
  if (!frozen) scene.setProgress(((now / 1000) % LOOP_SECONDS) / LOOP_SECONDS)
  scene.frame(ctx, { width: canvas.clientWidth, height: canvas.clientHeight }, dpr, dt)
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

// Deterministic hooks for the browser tests: freeze the clock, set progress.
declare global {
  interface Window {
    __kakeya: { setProgress(u: number): void; freeze(): void; scale(): number }
  }
}
window.__kakeya = {
  setProgress(u: number) {
    frozen = true
    scene.setProgress(u)
  },
  freeze() {
    frozen = true
  },
  scale() {
    return scene.scale() * dpr
  },
}

import { spring, stepSpring, settled, type Spring } from './spring'

/**
 * The camera is three springs: world-space center x, y, and the LOG of the
 * zoom. Interpolating zoom in log space reads as a constant-rate zoom on
 * screen; interpolating the scale directly reads as a lurch. Nothing drives
 * the canvas transform except this state.
 */
export interface Camera {
  x: Spring
  y: Spring
  logZoom: Spring
}

export interface CameraTarget {
  readonly x: number
  readonly y: number
  /** Pixels per world unit. */
  readonly zoom: number
}

export interface Viewport {
  readonly width: number
  readonly height: number
}

export const camera = (t: CameraTarget): Camera => ({
  x: spring(t.x),
  y: spring(t.y),
  logZoom: spring(Math.log(t.zoom)),
})

// Touch scrolling tracks the finger; springs tuned for wheel input read as
// lag under direct manipulation, so coarse pointers get stiffer ones.
const COARSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const OMEGA_PAN = COARSE ? 11 : 6
const OMEGA_ZOOM = COARSE ? 9 : 5
/** Cap on log-zoom velocity: at most ~e^3 change per second. */
const MAX_ZOOM_RATE = COARSE ? 5 : 3

export const stepCamera = (cam: Camera, target: CameraTarget, dt: number): Camera => ({
  x: stepSpring(cam.x, target.x, dt, OMEGA_PAN),
  y: stepSpring(cam.y, target.y, dt, OMEGA_PAN),
  logZoom: stepSpring(cam.logZoom, Math.log(target.zoom), dt, OMEGA_ZOOM, MAX_ZOOM_RATE),
})

export const cameraSettled = (cam: Camera, target: CameraTarget): boolean =>
  settled(cam.x, target.x) &&
  settled(cam.y, target.y) &&
  settled(cam.logZoom, Math.log(target.zoom))

export interface Transform {
  readonly scale: number
  readonly tx: number
  readonly ty: number
}

/** World to screen: y up in the world, y down on the canvas, center centered. */
export const cameraTransform = (cam: Camera, vp: Viewport): Transform => {
  const scale = Math.exp(cam.logZoom.value)
  return {
    scale,
    tx: vp.width / 2 - cam.x.value * scale,
    ty: vp.height / 2 + cam.y.value * scale,
  }
}

export const worldToScreen = (
  t: Transform,
  wx: number,
  wy: number,
): { readonly x: number; readonly y: number } => ({
  x: t.tx + wx * t.scale,
  y: t.ty - wy * t.scale,
})

export const screenToWorld = (
  t: Transform,
  sx: number,
  sy: number,
): { readonly x: number; readonly y: number } => ({
  x: (sx - t.tx) / t.scale,
  y: (t.ty - sy) / t.scale,
})

/** The target that frames a world box with the given margin fraction. */
export const frameBox = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  vp: Viewport,
  margin = 0.1,
): CameraTarget => {
  const w = Math.max(maxX - minX, 1e-9)
  const h = Math.max(maxY - minY, 1e-9)
  const zoom = Math.min(vp.width / w, vp.height / h) * (1 - margin)
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom }
}

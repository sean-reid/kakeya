import { describe, expect, it } from 'vitest'
import {
  camera,
  cameraSettled,
  cameraTransform,
  frameBox,
  screenToWorld,
  stepCamera,
  worldToScreen,
} from '../src/engine/camera'

const vp = { width: 1200, height: 800 }

describe('camera motion', () => {
  it('converges to a new target and reports settled', () => {
    let cam = camera({ x: 0, y: 0, zoom: 100 })
    const target = { x: 5, y: -2, zoom: 400 }
    for (let i = 0; i < 600; i++) cam = stepCamera(cam, target, 1 / 60)
    expect(cam.x.value).toBeCloseTo(5, 3)
    expect(cam.y.value).toBeCloseTo(-2, 3)
    expect(Math.exp(cam.logZoom.value)).toBeCloseTo(400, 1)
    expect(cameraSettled(cam, target)).toBe(true)
  })

  it('zooms through the geometric midpoint, not the arithmetic one', () => {
    let cam = camera({ x: 0, y: 0, zoom: 10 })
    const target = { x: 0, y: 0, zoom: 1000 }
    const scales: number[] = []
    for (let i = 0; i < 2000; i++) {
      cam = stepCamera(cam, target, 1 / 120)
      scales.push(Math.exp(cam.logZoom.value))
    }
    const passedMidpoint = scales.findIndex((s) => s >= 100)
    const arithmeticIdx = scales.findIndex((s) => s >= 505)
    expect(passedMidpoint).toBeGreaterThan(0)
    expect(passedMidpoint).toBeLessThan(arithmeticIdx)
  })

  it('caps how fast the zoom can move', () => {
    let cam = camera({ x: 0, y: 0, zoom: 1 })
    for (let i = 0; i < 100; i++) {
      cam = stepCamera(cam, { x: 0, y: 0, zoom: 1e9 }, 1 / 60)
      expect(Math.abs(cam.logZoom.velocity)).toBeLessThanOrEqual(3)
    }
  })
})

describe('camera transform', () => {
  it('round-trips world and screen coordinates', () => {
    const cam = camera({ x: 3, y: 1.5, zoom: 250 })
    const t = cameraTransform(cam, vp)
    const s = worldToScreen(t, 4.2, -0.7)
    const w = screenToWorld(t, s.x, s.y)
    expect(w.x).toBeCloseTo(4.2, 10)
    expect(w.y).toBeCloseTo(-0.7, 10)
  })

  it('centers the camera center in the viewport with y flipped', () => {
    const cam = camera({ x: 2, y: 3, zoom: 100 })
    const t = cameraTransform(cam, vp)
    const s = worldToScreen(t, 2, 3)
    expect(s.x).toBeCloseTo(600, 10)
    expect(s.y).toBeCloseTo(400, 10)
    const above = worldToScreen(t, 2, 4)
    expect(above.y).toBeLessThan(s.y)
  })
})

describe('frameBox', () => {
  it('fits the box inside the viewport with margin', () => {
    const target = frameBox(-1, 0, 3, 1, vp, 0.1)
    expect(target.x).toBe(1)
    expect(target.y).toBe(0.5)
    expect(target.zoom * 4).toBeLessThanOrEqual(vp.width)
    expect(target.zoom * 1).toBeLessThanOrEqual(vp.height)
  })

  it('picks the tighter axis', () => {
    const wide = frameBox(0, 0, 10, 1, vp)
    const tall = frameBox(0, 0, 1, 10, vp)
    expect(wide.zoom).toBeCloseTo((vp.width / 10) * 0.9, 6)
    expect(tall.zoom).toBeCloseTo((vp.height / 10) * 0.9, 6)
  })
})

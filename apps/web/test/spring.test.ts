import { describe, expect, it } from 'vitest'
import { settled, spring, stepSpring } from '../src/engine/spring'

const OMEGA = 8

describe('stepSpring', () => {
  it('converges to the target and stays there', () => {
    let s = spring(0)
    for (let i = 0; i < 300; i++) s = stepSpring(s, 5, 1 / 60, OMEGA)
    expect(s.value).toBeCloseTo(5, 6)
    expect(s.velocity).toBeCloseTo(0, 6)
    expect(settled(s, 5)).toBe(true)
  })

  it('never overshoots from rest', () => {
    let s = spring(0)
    let prev = 0
    for (let i = 0; i < 600; i++) {
      s = stepSpring(s, 1, 1 / 120, OMEGA)
      expect(s.value).toBeLessThanOrEqual(1 + 1e-12)
      expect(s.value).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = s.value
    }
  })

  it('is frame-rate independent: split steps equal one big step exactly', () => {
    const target = 3
    const one = stepSpring({ value: 0, velocity: 2 }, target, 0.5, OMEGA)
    let many = { value: 0, velocity: 2 }
    for (let i = 0; i < 50; i++) many = stepSpring(many, target, 0.01, OMEGA)
    expect(many.value).toBeCloseTo(one.value, 10)
    expect(many.velocity).toBeCloseTo(one.velocity, 10)
  })

  it('honors the velocity cap', () => {
    let s = spring(0)
    for (let i = 0; i < 100; i++) {
      s = stepSpring(s, 100, 1 / 60, OMEGA, 3)
      expect(Math.abs(s.velocity)).toBeLessThanOrEqual(3)
    }
  })

  it('a still spring on target does not move', () => {
    const s = stepSpring({ value: 2, velocity: 0 }, 2, 1 / 60, OMEGA)
    expect(s.value).toBe(2)
    expect(s.velocity).toBeCloseTo(0, 12)
  })

  it('handles retargeting mid-flight without jumps', () => {
    let s = spring(0)
    for (let i = 0; i < 30; i++) s = stepSpring(s, 1, 1 / 60, OMEGA)
    const before = s.value
    s = stepSpring(s, -1, 1 / 60, OMEGA)
    expect(Math.abs(s.value - before)).toBeLessThan(0.1)
  })
})

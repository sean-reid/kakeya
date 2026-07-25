/**
 * Critically damped spring, advanced by the exact closed-form solution
 * x(t) = target + (A + B*t) * exp(-omega*t), so stepping is frame-rate
 * independent: many small steps land exactly where one big step does.
 * Scroll sets targets; springs follow; the camera never sees raw input.
 */
export interface Spring {
  value: number
  velocity: number
}

export const spring = (value: number): Spring => ({ value, velocity: 0 })

export const stepSpring = (
  s: Spring,
  target: number,
  dt: number,
  omega: number,
  maxVelocity = Infinity,
): Spring => {
  const x0 = s.value - target
  const a = x0
  const b = s.velocity + omega * x0
  const decay = Math.exp(-omega * dt)
  const value = target + (a + b * dt) * decay
  let velocity = (b - omega * (a + b * dt)) * decay
  if (Math.abs(velocity) > maxVelocity) velocity = Math.sign(velocity) * maxVelocity
  return { value, velocity }
}

/** True once the spring has effectively arrived, for skipping idle redraws. */
export const settled = (s: Spring, target: number, tol = 1e-4): boolean =>
  Math.abs(s.value - target) < tol && Math.abs(s.velocity) < tol

export interface Vec {
  readonly x: number
  readonly y: number
}

export const vec = (x: number, y: number): Vec => ({ x, y })

export const add = (a: Vec, b: Vec): Vec => vec(a.x + b.x, a.y + b.y)
export const sub = (a: Vec, b: Vec): Vec => vec(a.x - b.x, a.y - b.y)
export const scale = (a: Vec, s: number): Vec => vec(a.x * s, a.y * s)
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x
export const len = (a: Vec): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec, b: Vec): number => len(sub(a, b))

/** Unit vector at angle theta (radians, counterclockwise from +x). */
export const dir = (theta: number): Vec => vec(Math.cos(theta), Math.sin(theta))

/** Rotate a about the origin by theta radians. */
export const rotate = (a: Vec, theta: number): Vec => {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return vec(a.x * c - a.y * s, a.x * s + a.y * c)
}

/** Rotate a about pivot p by theta radians. */
export const rotateAbout = (a: Vec, p: Vec, theta: number): Vec => add(p, rotate(sub(a, p), theta))

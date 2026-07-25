/**
 * The story, beat by beat. Copy is museum-sparse and every number is a
 * measured one: the area table is generated and cross-checked in CI, and the
 * counter shown on screen reads from the same source.
 */
export interface Beat {
  readonly id: string
  /** Scroll room, in viewport heights. */
  readonly heights: number
  /** The label text shown while the beat is active. Empty string: no card. */
  readonly copy: string
  /** Small attribution or figure line under the copy, when one belongs. */
  readonly note?: string
  /** For screen readers: what the picture is doing. */
  readonly describe: string
}

export const BEATS: readonly Beat[] = [
  {
    id: 'needle',
    heights: 1.2,
    copy: 'A needle of length one. It must turn all the way around.',
    describe: 'A single red needle rests on warm paper.',
  },
  {
    id: 'halfdisc',
    heights: 1.6,
    copy: 'Swung like a clock hand, it sweeps half a disc. 1.5708 square units of floor.',
    describe:
      'The needle pivots about one end through a half turn, shading in the half disc it sweeps.',
  },
  {
    id: 'question',
    heights: 1.2,
    copy: 'In 1917, Soichi Kakeya asked how much less would do.',
    describe: 'The swept half disc fades, leaving the needle and the question.',
  },
  {
    id: 'deltoid',
    heights: 1.8,
    copy: 'His candidate: a three-cusped curve. Area 0.3927. A quarter of the half disc.',
    note: 'The deltoid',
    describe:
      'A three-cusped deltoid curve. The needle turns fully around inside it, both ends gliding along the curve.',
  },
  {
    id: 'besicovitch',
    heights: 1.2,
    copy: 'Abram Besicovitch, 1928: there is no least area. Start with a triangle.',
    describe: 'A single flat triangle appears, area 0.5774.',
  },
  {
    id: 'construction',
    heights: 2.6,
    copy: 'Cut it into slivers and slide them into each other. Every sliver still points the way it pointed. The room shrinks.',
    note: 'The Perron tree',
    describe:
      'The triangle splits into thinner and thinner triangles that slide sideways into heavy overlap, forming a spiky tree. A counter shows the area falling from 0.5774 to 0.1744.',
  },
  {
    id: 'join',
    heights: 2.2,
    copy: 'To pass between slivers, the needle slides out along its own line, tilts, and slides back. The farther the detour, the thinner its cost. Pal, 1920.',
    describe:
      'The camera follows the needle on a long excursion away from the figure and back, along faint travel lines.',
  },
  {
    id: 'sweep',
    heights: 2.6,
    copy: 'The full turn. The tree costs four tenths; the stubby detours drawn here cost more than they must. Stretch them off the page and their price falls toward nothing.',
    describe:
      'The needle works through the whole spiky figure, turning through every direction while staying inside it.',
  },
  {
    id: 'solved',
    heights: 1.4,
    copy: 'The flat problem was settled by 1928. Its cousin in space held out for a century, until Hong Wang and Joshua Zahl closed it in 2025. The Fields Medal followed.',
    describe: 'The finished figure rests.',
  },
  {
    id: 'coda',
    heights: 1.6,
    copy: 'Picture the same game in space: a needle, every direction, almost no room. That is the world Wang and Zahl mapped.',
    describe: 'The figure holds while the closing line appears.',
  },
]

export const totalHeights = (): number => BEATS.reduce((s, b) => s + b.heights, 0)

/** Map global progress in [0,1] to the active beat and local progress within it. */
export const beatAt = (u: number): { readonly index: number; readonly local: number } => {
  const total = totalHeights()
  let acc = 0
  const clamped = Math.min(Math.max(u, 0), 1)
  for (let i = 0; i < BEATS.length; i++) {
    const span = BEATS[i]!.heights / total
    if (clamped <= acc + span || i === BEATS.length - 1) {
      return { index: i, local: Math.min(Math.max((clamped - acc) / span, 0), 1) }
    }
    acc += span
  }
  return { index: BEATS.length - 1, local: 1 }
}

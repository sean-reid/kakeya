import { expect, test } from '@playwright/test'
import { BEATS, totalHeights } from '../src/story/beats'

const BEAT_IDS = BEATS.map((b) => b.id)

/** Global progress at the middle of a beat, honoring the height weights. */
const beatCenter = (id: string): number => {
  const total = totalHeights()
  let acc = 0
  for (const b of BEATS) {
    if (b.id === id) return (acc + b.heights / 2) / total
    acc += b.heights
  }
  throw new Error(`unknown beat ${id}`)
}

test('scrolling the story surfaces every beat in order', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto('./')
  await page.waitForFunction(() => typeof window.__kakeya !== 'undefined')

  const storyHeight = await page.evaluate(() => {
    const story = document.getElementById('story')!
    return story.offsetHeight - window.innerHeight
  })
  expect(storyHeight).toBeGreaterThan(0)

  for (const id of BEAT_IDS) {
    const u = beatCenter(id)
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), storyHeight * u)
    await expect(page.locator(`.beat[data-beat="${id}"]`)).toHaveClass(/active/)
    await expect(page.locator(`.beat[data-beat="${id}"] .card`)).toBeVisible()
  }

  expect(errors).toEqual([])
})

test('the leaving fade always completes before the entering fade starts', async ({ page }) => {
  await page.goto('./')
  const timing = await page.evaluate(() => {
    // The first beat is active on load; probe one that is not.
    const probe = document.querySelectorAll('.beat')[3]!.querySelector('.card')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const outDuration = parseFloat(getComputedStyle(probe).transitionDuration)
    probe.closest('.beat')!.classList.add('active')
    const inDelay = parseFloat(getComputedStyle(probe).transitionDelay)
    probe.closest('.beat')!.classList.remove('active')
    return { outDuration, inDelay, reduced }
  })
  if (timing.reduced) {
    // Reduced motion swaps instantly; instant swaps cannot overlap.
    expect(timing.outDuration).toBe(0)
  } else {
    expect(timing.inDelay).toBeGreaterThan(timing.outDuration)
  }
})

test('two cards never read as visible together', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof window.__kakeya !== 'undefined')
  const storyHeight = await page.evaluate(() => {
    const story = document.getElementById('story')!
    return story.offsetHeight - window.innerHeight
  })

  // Walk across every beat boundary and watch the fades play out.
  for (let i = 1; i < BEATS.length; i++) {
    const boundary = BEATS.slice(0, i).reduce((s, b) => s + b.heights, 0) / totalHeights()
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: 'instant' }),
      storyHeight * (boundary + 0.005),
    )
    for (let probe = 0; probe < 5; probe++) {
      await page.waitForTimeout(90)
      const readable = await page.evaluate(
        () =>
          [...document.querySelectorAll('.beat .card')].filter(
            (c) => parseFloat(getComputedStyle(c).opacity) > 0.5,
          ).length,
      )
      expect(readable).toBeLessThanOrEqual(1)
    }
  }
})

test('beat plates render for review', async ({ page }, testInfo) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof window.__kakeya !== 'undefined')
  const storyHeight = await page.evaluate(() => {
    const story = document.getElementById('story')!
    return story.offsetHeight - window.innerHeight
  })

  for (let i = 0; i < BEAT_IDS.length; i++) {
    const u = beatCenter(BEAT_IDS[i]!)
    // Really scroll, so the sticky cards are part of the picture too.
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), storyHeight * u)
    await page.evaluate(() => window.__kakeya.settle())
    await page.waitForTimeout(850)
    await page.screenshot({
      path: testInfo.outputPath(`beat-${String(i).padStart(2, '0')}-${BEAT_IDS[i]}.png`),
    })
  }
})

test('the whole story keeps the needle at unit length', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof window.__kakeya !== 'undefined')

  for (const u of ['needle', 'halfdisc', 'deltoid', 'join'].map(beatCenter)) {
    await page.evaluate((v) => window.__kakeya.setProgress(v), u)
    // Self-healing probe: re-settle and wait for two painted frames on every
    // attempt, so one starved frame under parallel load cannot strand it.
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.__kakeya.settle())
          await page.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
          )
          return measureNeedle(page)
        },
        { timeout: 15_000 },
      )
      .toEqual(expect.objectContaining({ ok: true }))
  }
})

const measureNeedle = async (page: import('@playwright/test').Page) => {
  const needle = await page.evaluate(() => {
    const canvas = document.getElementById('plate') as HTMLCanvasElement
    const c = canvas.getContext('2d')!
    const { width, height } = canvas
    const data = c.getImageData(0, 0, width, height).data
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        // RED #c73a26 dominance test: survives antialiasing at tiny scales,
        // rejects paper, wash, and ink, which are all near-neutral.
        const r = data[i]!
        if (r > 160 && data[i + 1]! < r - 55 && data[i + 2]! < r - 55) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }
    return { span: Math.hypot(maxX - minX, maxY - minY), scale: window.__kakeya.scale() }
  })
  // The 4px allowance covers stroke caps and antialiasing, which read as
  // extra length when the camera is far out and the needle is a few px long.
  return {
    ok: needle.span > needle.scale * 0.9 && needle.span < needle.scale * 1.1 + 4,
    span: needle.span,
    scale: needle.scale,
  }
}

test('no readable card ever reaches the masthead zone', async ({ page }) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof window.__kakeya !== 'undefined')
  const storyHeight = await page.evaluate(() => {
    const story = document.getElementById('story')!
    return story.offsetHeight - window.innerHeight
  })

  for (let i = 0; i <= 30; i++) {
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: 'instant' }),
      (storyHeight * i) / 30,
    )
    await page.waitForTimeout(300)
    const intruders = await page.evaluate(() => {
      const limit = window.innerHeight * 0.14
      return [...document.querySelectorAll('.beat .card')].filter((c) => {
        const opacity = parseFloat(getComputedStyle(c).opacity)
        return opacity > 0.3 && c.getBoundingClientRect().top < limit
      }).length
    })
    expect(intruders).toBe(0)
  }
})

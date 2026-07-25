import { expect, test } from '@playwright/test'
import { BEATS } from '../src/story/beats'

const BEAT_IDS = BEATS.map((b) => b.id)

/** Global progress at the middle of a beat, honoring the height weights. */
const beatCenter = (id: string): number => {
  const total = BEATS.reduce((s, b) => s + b.heights, 0)
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

  await page.goto('./')
  await page.waitForFunction(() => typeof window.__kakeya !== 'undefined')

  const storyHeight = await page.evaluate(() => {
    const story = document.getElementById('story')!
    return story.offsetHeight - window.innerHeight
  })
  expect(storyHeight).toBeGreaterThan(0)

  for (const id of BEAT_IDS) {
    const u = beatCenter(id)
    const beat = BEATS.find((b) => b.id === id)!
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), storyHeight * u)
    await expect(page.locator(`.beat[data-beat="${id}"]`)).toHaveClass(/active/)
    await expect(page.locator('#label')).toContainText(beat.copy.slice(0, 24))
    await expect(page.locator('#label')).toHaveClass(/shown/)
  }

  // One label element, ever - two boxes can never share the screen.
  await expect(page.locator('#label')).toHaveCount(1)

  expect(errors).toEqual([])
})

test('beat plates render for review', async ({ page }, testInfo) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof window.__kakeya !== 'undefined')

  for (let i = 0; i < BEAT_IDS.length; i++) {
    const u = beatCenter(BEAT_IDS[i]!)
    await page.evaluate((v) => window.__kakeya.setProgress(v), u)
    await page.evaluate(() => window.__kakeya.settle())
    await page.waitForTimeout(150)
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
    await page.evaluate(() => window.__kakeya.settle())
    await page.waitForTimeout(150)
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
          if (data[i]! > 150 && data[i + 1]! < 90 && data[i + 2]! < 80) {
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
          }
        }
      }
      return { span: Math.hypot(maxX - minX, maxY - minY), scale: window.__kakeya.scale() }
    })
    expect(needle.span).toBeGreaterThan(needle.scale * 0.9)
    expect(needle.span).toBeLessThan(needle.scale * 1.15)
  }
})

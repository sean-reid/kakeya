import { expect, test } from '@playwright/test'

test('the plate renders the sweep at key moments', async ({ page }, testInfo) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof window.__kakeya !== 'undefined')

  for (const u of [0, 0.12, 0.35, 0.7, 1]) {
    await page.evaluate((v) => window.__kakeya.setProgress(v), u)
    await page.waitForTimeout(700)
    await page.screenshot({ path: testInfo.outputPath(`plate-${String(u).replace('.', '_')}.png`) })
  }

  const needle = await page.evaluate(() => {
    const canvas = document.getElementById('plate') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
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
  expect(needle.span).toBeGreaterThan(needle.scale * 0.95)
  expect(needle.span).toBeLessThan(needle.scale * 1.1)

  const pixels = await page.evaluate(() => {
    const canvas = document.getElementById('plate') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let nonPaper = 0
    for (let i = 0; i < data.length; i += 40) {
      if (Math.abs(data[i]! - 245) > 12 || Math.abs(data[i + 1]! - 239) > 12) nonPaper++
    }
    return nonPaper
  })
  expect(pixels).toBeGreaterThan(100)
})

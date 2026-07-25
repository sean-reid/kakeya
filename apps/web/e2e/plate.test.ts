import { expect, test } from '@playwright/test'

test('the plate renders the sweep at key moments', async ({ page }, testInfo) => {
  await page.goto('./')
  await page.waitForFunction(() => typeof window.__kakeya !== 'undefined')

  for (const u of [0, 0.12, 0.35, 0.7, 1]) {
    await page.evaluate((v) => window.__kakeya.setProgress(v), u)
    await page.waitForTimeout(700)
    await page.screenshot({ path: testInfo.outputPath(`plate-${String(u).replace('.', '_')}.png`) })
  }

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

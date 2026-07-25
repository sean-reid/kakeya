import { expect, test } from '@playwright/test'

const detoursOf = (text: string): number => {
  const m = text.match(/detours ([\d.]+)/)
  if (!m) throw new Error(`no detours number in: ${text}`)
  return Number(m[1])
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.locator('#playground').scrollIntoViewIfNeeded()
})

test('the instrument renders with its area line', async ({ page }) => {
  await expect(page.getByTestId('playground-area')).toContainText('tree')
  await expect(page.getByTestId('playground-area')).toContainText('detours')
  for (const id of ['play', 'direction', 'depth', 'excursion', 'speed', 'follow', 'trail']) {
    await expect(page.getByTestId(id)).toBeAttached()
  }
})

test('stretching the detours makes their cost fall', async ({ page }) => {
  const area = page.getByTestId('playground-area')
  await page.getByTestId('excursion').fill('10')
  const short = detoursOf((await area.textContent())!)
  await page.getByTestId('excursion').fill('100')
  const long = detoursOf((await area.textContent())!)
  expect(long).toBeLessThan(short / 3)
})

test('cutting deeper shrinks the tree', async ({ page }) => {
  const area = page.getByTestId('playground-area')
  await page.getByTestId('depth').fill('2')
  const shallow = (await area.textContent())!
  await page.getByTestId('depth').fill('8')
  const deep = (await area.textContent())!
  const treeOf = (t: string): number => Number(t.match(/tree ([\d.]+)/)![1])
  expect(treeOf(deep)).toBeLessThan(treeOf(shallow))
})

test('the dial sends the needle to a direction', async ({ page }) => {
  await page.getByTestId('direction').fill('90')
  await expect
    .poll(
      async () => {
        const readout = await page
          .locator('.control', { has: page.getByTestId('direction') })
          .locator('.control-value')
          .textContent()
        return Number(readout?.match(/(\d+)/)?.[1] ?? -1)
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(80)
})

test('the play button turns the needle continuously', async ({ page }) => {
  const play = page.getByTestId('play')
  await play.click()
  await expect(play).toHaveText(/hold still/i)
  await play.click()
  await expect(play).toHaveText(/turn the needle/i)
})

test('controls work from the keyboard', async ({ page }) => {
  const depth = page.getByTestId('depth')
  await depth.focus()
  const before = await depth.inputValue()
  await page.keyboard.press('ArrowRight')
  const after = await depth.inputValue()
  expect(Number(after)).toBe(Math.min(8, Number(before) + 1))
})

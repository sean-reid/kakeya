import { expect, test } from '@playwright/test'

test('the page loads cleanly', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto('./')

  await expect(page).toHaveTitle('Kakeya')
  await expect(page.getByRole('heading', { level: 1, name: 'Kakeya' })).toBeVisible()
  expect(errors).toEqual([])
})

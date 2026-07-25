import { expect, test } from '@playwright/test'

test('the reading list runs from the news to the proof', async ({ page }) => {
  await page.goto('./')
  const items = page.locator('#reading li')
  await expect(items).toHaveCount(7)

  const links = page.locator('#reading a')
  const hosts = [
    'quantamagazine.org',
    'quantamagazine.org',
    'wikipedia.org',
    'math.wustl.edu',
    'terrytao.wordpress.com',
    'arxiv.org',
    'arxiv.org',
  ]
  for (let i = 0; i < hosts.length; i++) {
    const href = await links.nth(i).getAttribute('href')
    expect(href).toContain(hosts[i]!)
  }

  await expect(page.locator('#reading li').last()).toContainText('Wang and Joshua Zahl')
  await expect(page.locator('#colophon')).toContainText('computed, not illustrated')
})

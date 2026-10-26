import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

// Start Vite first. Override the URL to check a deployed branch preview.
const url = process.env.GROVE_URL || 'http://127.0.0.1:5187/'
const screenshots = 'docs/pixel-grove/screenshots'
await mkdir(screenshots, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.route(/https:\/\/(all-sites-analytics\.pages\.dev\/a\.js|static\.cloudflareinsights\.com\/beacon\.min\.js)/, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  const errors = []
  const missing = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => { if (response.status() >= 400 && response.url().includes('/pixel-grove/')) missing.push(response.url()) })
  // Heads on the coin, reproducible wake-up checks for this UI test.
  await page.addInitScript(() => { Math.random = () => 0.9 })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Pocket Grove.' }).waitFor()
  await page.screenshot({ path: `${screenshots}/desktop.png` })
  const desktopFits = await page.evaluate(() => {
    const board = document.querySelector('.grove-board').getBoundingClientRect()
    return document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight && board.bottom <= innerHeight
  })
  assert.ok(desktopFits, 'the desktop battle table and controls should fit')
  assert.equal(await page.locator('[data-creature="p-pikachu"] [data-pose]').getAttribute('data-pose'), 'sleeping')

  await page.getByRole('button', { name: 'Play Electrode', exact: true }).click()
  await page.locator('[data-creature="p-voltorb"]').click()
  assert.equal(await page.locator('[data-creature="p-voltorb"]').getAttribute('data-species'), 'electrode')
  await page.getByRole('button', { name: 'Play Voltorb', exact: true }).click()
  await page.getByRole('button', { name: 'Empty bench patch 2', exact: true }).click()
  assert.equal(await page.locator('.grove-creature.benched.player').count(), 3)
  await page.getByRole('button', { name: 'Flip wake-up coin', exact: true }).click()
  assert.equal(await page.locator('[data-creature="p-pikachu"] [data-pose]').getAttribute('data-pose'), 'awake')
  await page.getByRole('button', { name: 'Play Lightning Energy', exact: true }).first().click()
  await page.locator('[data-creature="p-pikachu"]').click()
  // A second Energy is refused and remains in hand.
  await page.getByRole('button', { name: 'Play Lightning Energy', exact: true }).first().click()
  await page.locator('[data-creature="p-pikachu"]').click()
  await page.getByRole('status').getByText('You already attached an Energy this turn.').waitFor()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: `${screenshots}/awake-and-evolved.png` })
  await page.getByRole('button', { name: 'Use Thunderbolt', exact: true }).click()
  await page.getByText('Their move…', { exact: true }).waitFor()
  await page.screenshot({ path: `${screenshots}/attack.png` })
  await page.getByText('Your move', { exact: true }).waitFor()
  assert.equal(await page.locator('.grove-creature.active.opponent').getAttribute('data-species'), 'weezing')

  // Healing and switching use real game controls too.
  await page.getByRole('button', { name: 'Play Potion', exact: true }).first().click()
  await page.locator('[data-creature="p-pikachu"]').click()
  await page.getByRole('status').getByText(/Potion healed/).waitFor()
  await page.locator('[data-creature="p-voltorb"]').click()
  await page.getByRole('button', { name: /Switch into the clearing/ }).click()
  assert.equal(await page.locator('.grove-creature.active.player').getAttribute('data-species'), 'electrode')

  await page.getByRole('button', { name: 'Restart battle', exact: true }).click()
  await page.getByRole('button', { name: 'Start a fresh battle ↗', exact: true }).click()
  await page.getByRole('button', { name: /The card collection/ }).click()
  assert.equal(await page.locator('.grove-card-album [data-card]').count(), 6)
  await page.screenshot({ path: `${screenshots}/card-album.png` })
  for (const species of ['pikachu', 'voltorb', 'electrode', 'koffing', 'weezing', 'jigglypuff']) {
    await mkdir('docs/pixel-grove/card-references', { recursive: true })
    await page.locator(`.grove-card-album [data-card="${species}"]`).screenshot({ path: `docs/pixel-grove/card-references/${species}.png`, scale: 'css' })
  }
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '? How to play', exact: true }).first().click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByRole('button', { name: /THE INSPIRATION/ }).click()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '♪ Sound off', exact: true }).first().click()
  await page.getByRole('button', { name: '♪ Sound on', exact: true }).first().click()

  for (const mode of ['light', 'transparent', 'dark']) {
    await page.getByRole('button', { name: `${mode[0].toUpperCase() + mode.slice(1)} appearance`, exact: true }).first().click()
    assert.equal(await page.locator('.grove-app').getAttribute('data-appearance'), mode)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${screenshots}/appearance-${mode}.png` })
  }
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.locator('.grove-app').getAttribute('data-appearance'), 'dark')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${screenshots}/mobile.png`, fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile should not overflow horizontally')
  await page.getByRole('button', { name: 'Play Lightning Energy', exact: true }).first().click()
  assert.equal(await page.locator('.grove-right.mobile-open').count(), 0, 'the details panel must not obstruct card targets')
  await page.locator('[data-creature="p-pikachu"]').click()
  await page.getByRole('button', { name: 'Pokémon & attacks ↗', exact: true }).click()
  await page.getByRole('button', { name: 'Flip a coin to wake up', exact: true }).click()
  await page.getByRole('button', { name: 'Transparent appearance', exact: true }).last().click()
  assert.equal(await page.locator('.grove-app').getAttribute('data-appearance'), 'transparent')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${screenshots}/mobile-details.png` })
  await page.getByRole('button', { name: 'Close Pokémon details', exact: true }).click()
  await page.getByRole('button', { name: 'End turn →', exact: true }).click()
  await page.getByText('Your move', { exact: true }).waitFor()
  await page.goto(new URL('/classic', url).href, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const settings = page.getByTestId('settings-modal')
  await settings.getByRole('button', { name: 'Transparent appearance', exact: true }).click()
  assert.equal(await page.locator('html').getAttribute('data-ppc-theme'), 'transparent')
  await settings.getByRole('button', { name: 'Light appearance', exact: true }).click()
  assert.equal(await page.locator('html').getAttribute('class'), '')
  await settings.getByRole('button', { name: 'Dark appearance', exact: true }).click()
  assert.equal(await page.locator('html').getAttribute('data-ppc-theme'), 'dark')
  assert.equal(errors.length, 0, errors.join('\n'))
  assert.equal(missing.length, 0, `Missing art assets: ${missing.join(', ')}`)
  console.log('Pixel Grove desktop/mobile flow passed. Screenshots and six card reference PNGs saved.')
} finally {
  await browser.close()
}

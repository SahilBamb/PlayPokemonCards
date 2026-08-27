// UI smoke test for the holographic card preview: right-click a Rare Holo in
// the Deck Editor browser, move the pointer over it, and confirm the shine
// layer reacts; commons must stay flat. Run with the dev server on :5199.
import { chromium } from 'playwright'
import fs from 'fs'

const shots = 'scripts/shots'
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

await page.addInitScript(() => {
  localStorage.setItem('ppc-settings', JSON.stringify({ animations: false, sound: false, volume: 0 }))
})
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: 'Deck Editor' }).click()
await page.waitForSelector('[data-testid="deck-count"]')

const openPreview = async (name) => {
  await page.locator('input[placeholder="Search cards…"]').fill(name)
  const tile = page.locator(`[data-browser-card="${name}"]`)
  await tile.waitFor({ state: 'visible' })
  await tile.click({ button: 'right' })
  await page.waitForSelector('[data-testid="card-preview"]')
  await page.waitForTimeout(600) // hires image swap-in
}

// 1. Rare Holo: shine layer present, tilts and lights up under the pointer
await openPreview('Alakazam')
const holo = page.locator('.holo-card')
if ((await holo.getAttribute('data-foil')) !== 'holo') errors.push('Alakazam preview missing data-foil="holo"')
if ((await page.locator('.holo-card__shine').count()) !== 1) errors.push('holo shine layer missing')

const box = await holo.boundingBox()
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.25, { steps: 8 })
await page.waitForTimeout(200)
const vars = await holo.evaluate((el) => ({
  opacity: el.style.getPropertyValue('--card-opacity'),
  rotateX: el.style.getPropertyValue('--rotate-x'),
}))
console.log('holo vars under pointer:', vars)
if (vars.opacity !== '1') errors.push(`--card-opacity should be 1 while hovering, got "${vars.opacity}"`)
if (!vars.rotateX || vars.rotateX === '0deg') errors.push(`card did not tilt, --rotate-x="${vars.rotateX}"`)
await page.screenshot({ path: `${shots}/h1_holo_shine.png` })

// preview must NOT close when clicking the card itself
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
await page.waitForTimeout(150)
if (!(await page.locator('[data-testid="card-preview"]').isVisible())) errors.push('preview closed on card click')

// Escape still closes
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
if (await page.locator('[data-testid="card-preview"]').count()) errors.push('Escape did not close preview')

// 2. Common: no shine layer, still tilts
await openPreview('Abra')
if (await page.locator('.holo-card__shine').count()) errors.push('common card has a shine layer')
if (await page.locator('.holo-card').getAttribute('data-foil')) errors.push('common card has data-foil set')
const box2 = await page.locator('.holo-card').boundingBox()
await page.mouse.move(box2.x + box2.width * 0.7, box2.y + box2.height * 0.6, { steps: 8 })
await page.waitForTimeout(200)
await page.screenshot({ path: `${shots}/h2_common_flat.png` })
// backdrop click closes
await page.mouse.click(40, 40)
await page.waitForTimeout(150)
if (await page.locator('[data-testid="card-preview"]').count()) errors.push('backdrop click did not close preview')

await browser.close()
if (errors.length) {
  console.error('FAIL:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('OK — holo preview behaves for holo + common cards')

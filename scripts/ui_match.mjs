// Match-mode UI smoke: menu -> deck picker -> setup -> a few AI turns.
// Asserts the opponent's hand is hidden (card backs, no faces) and prizes render.
// Run with the dev server on :5199.
import { chromium } from 'playwright'
import fs from 'fs'

const shots = 'scripts/shots'
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: `${shots}/m1_menu.png` })

// Menu -> deck picker -> start
await page.getByRole('button', { name: 'Play Game' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${shots}/m2_deck_picker.png` })
await page.getByRole('button', { name: 'Start Match' }).click()
await page.waitForTimeout(600)

// Setup phase visible
const setupText = await page.locator('text=/Setup:/').first().isVisible().catch(() => false)
if (!setupText) errors.push('setup bar not shown')

// Opponent hand must be card backs only (no faces). Card faces have a
// non-empty alt (the card name); the pokéball art inside card backs has alt="".
const faceImgs = (scope) => page.locator(`${scope} img:not([alt=""])`)
const oppFaces = await faceImgs('[data-testid="hand-p2"]').count()
const oppBacks = await page.locator('[data-testid="hand-p2"] [data-testid="card-back"]').count()
console.log('opponent hand: faces =', oppFaces, 'backs =', oppBacks)
if (oppFaces > 0) errors.push('opponent hand shows card faces')
// The AI may already have played cards from its opening 7 by the time we count
if (oppBacks < 1) errors.push('opponent hand backs missing')

// Prizes render for both players (6 face-down each)
for (const p of ['p1', 'p2']) {
  const n = await page.locator(`[data-testid="prizes-${p}"] [data-testid="card-back"]`).count()
  console.log(`prizes ${p}:`, n)
  if (n !== 6) errors.push(`expected 6 prizes for ${p}, saw ${n}`)
}

// Place an Active: drag hand cards onto the active spot until one sticks
// (opening hands are random; non-basics are rejected by the engine).
const activeSpot = () => page.locator('div.border-r-2 > div').first()
const handSize = await faceImgs('[data-testid="hand-p1"]').count()
for (let i = 0; i < handSize; i++) {
  const placed = (await activeSpot().locator('img:not([alt=""])').count()) > 0
  if (placed) break
  const card = faceImgs('[data-testid="hand-p1"]').nth(i)
  await card.hover()
  await page.waitForTimeout(250)
  const src = await card.boundingBox()
  const dst = await activeSpot().boundingBox()
  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2)
  await page.mouse.down()
  await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(250)
}
if ((await activeSpot().locator('img:not([alt=""])').count()) === 0) errors.push('could not place an Active during setup')
await page.screenshot({ path: `${shots}/m3_setup_active.png` })

// Ready up, then let the AI play a few moves
await page.getByRole('button', { name: 'Ready' }).click()
await page.waitForTimeout(5000)

const banner = await page.locator('[data-testid="turn-banner"]').innerText().catch(() => '')
console.log('turn banner:', banner)
if (!/Your turn|Opponent is thinking/.test(banner)) errors.push('turn banner missing after setup: ' + banner)

// AI should have placed an Active by now
const aiActive = await page.locator('div.border-l-2 img:not([alt=""])').count()
console.log('AI board active imgs:', aiActive)
if (aiActive === 0) errors.push('AI never placed an Active')

// Hidden-hand assertion still holds mid-game
const facesMidGame = await faceImgs('[data-testid="hand-p2"]').count()
if (facesMidGame > 0) errors.push('opponent hand leaked faces mid-game')

await page.screenshot({ path: `${shots}/m4_match_running.png` })
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'Match UI smoke passed, no console errors')
await browser.close()
process.exit(errors.length ? 1 : 0)

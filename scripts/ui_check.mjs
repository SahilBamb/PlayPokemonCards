// UI smoke test: loads the sandbox, plays cards via real drag/click input,
// and captures screenshots. Run with the dev server on :5199.
import { chromium } from 'playwright'
import fs from 'fs'

const shots = 'scripts/shots'
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

// deterministic runs: disable battle animations and sound
await page.addInitScript(() => localStorage.setItem('ppc-settings', JSON.stringify({ animations: false, sound: false, volume: 0 })))
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
// Navigate the main menu into the sandbox
await page.getByRole('button', { name: 'Sandbox' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${shots}/1_initial.png` })

// The initial hands are random; drive the engine deterministically by dispatching
// through the store is not possible from outside, so use real interactions where
// stable and assert on visible artifacts.

// 1. Draw a card: click p1's deck (bottom row, first blue pile)
const decks = page.locator('div[title="Click to draw"]')
const p1DeckBefore = await decks.nth(1).innerText()
await decks.nth(1).click()
const p1DeckAfter = await decks.nth(1).innerText()
console.log('deck draw:', p1DeckBefore, '->', p1DeckAfter)
if (+p1DeckAfter !== +p1DeckBefore - 1) errors.push('deck count did not decrease')

// 2. End turn button works
await page.getByRole('button', { name: 'End Turn' }).click()
const turnLabel = await page.locator('text=/turn · #/').innerText()
console.log('turn label:', turnLabel)
if (!turnLabel.includes('p2')) errors.push('turn did not pass to p2')
await page.getByRole('button', { name: 'End Turn' }).click()

// 3. Drag a basic pokemon from p1 hand to the active spot via real HTML5 DnD.
//    Spawn a known Basic so the test doesn't depend on the random opening hand.
await page.evaluate(() => window.__game.spawn('Ponyta', 'p1'))
await page.waitForTimeout(150)
// Hover first so the fanned card lifts out of the overlap, then drag manually
// (mouse steps are needed for Chromium to emit HTML5 drag events reliably).
const srcLoc = page.locator('div[draggable="true"]:has(img[alt="Ponyta"])').last()
await srcLoc.hover()
await page.waitForTimeout(350)
const src = await srcLoc.boundingBox()
const dst = await page.locator('div.border-r-2 > div').first().boundingBox()
await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2)
await page.mouse.down()
await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 15 })
await page.mouse.up()
await page.waitForTimeout(300)
const placed = (await page.locator('div.border-r-2 img[alt="Ponyta"]').count()) > 0
console.log('placed Ponyta on active via drag:', placed)
if (!placed) errors.push('drag-to-play failed')
await page.waitForTimeout(400)
await page.screenshot({ path: `${shots}/2_after_actions.png` })

// 4. Reset works
await page.getByRole('button', { name: 'Reset' }).click()
await page.waitForTimeout(300)

// 5. Discard viewer opens/closes
await page.locator('div[title="Click to view discard pile"]').first().click()
await page.waitForTimeout(200)
const closeBtn = page.getByRole('button', { name: 'Close' })
if (!(await closeBtn.isVisible())) errors.push('zone viewer did not open')
await page.screenshot({ path: `${shots}/3_zone_viewer.png` })
await closeBtn.click()

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'UI smoke passed, no console errors')
await browser.close()
process.exit(errors.length ? 1 : 0)

// UI smoke test for the sandbox testing tools: card catalog sidebar
// (right-click open, favorites, drag to field/discard) and the
// turn-based rules toggle. Run with the dev server on :5199.
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
await page.getByRole('button', { name: 'Sandbox' }).click()
await page.waitForTimeout(400)

// 1. Right-click on the right side of the screen switches the side panel
//    from the game log to the card catalog tab
await page.mouse.click(1450, 500, { button: 'right' })
await page.waitForTimeout(300)
const catalog = page.locator('[data-testid="card-catalog"]')
if (!(await catalog.isVisible())) errors.push('catalog did not open on right-click')
await page.screenshot({ path: `${shots}/s1_catalog_open.png` })

// 2. Search, then drag Charizard from the catalog onto p1's active spot
await catalog.locator('input').fill('charizard')
await page.waitForTimeout(400)
const entry = catalog.locator('img[alt="Charizard"]').first()
await entry.waitFor({ state: 'visible' })
const src = await entry.boundingBox()
const dst = await page.locator('div.border-r-2 > div').first().boundingBox()
await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2)
await page.mouse.down()
await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 15 })
await page.mouse.up()
await page.waitForTimeout(300)
const placed = (await page.locator('div.border-r-2 img[alt="Charizard"]').count()) > 0
console.log('catalog drag placed Charizard:', placed)
if (!placed) errors.push('catalog drag-to-field failed')

// 3. Favorite Charizard: it should appear in the frozen Favorites section
await catalog.locator('div[title^="Charizard"]').first().hover()
await catalog.getByTitle('Favorite').first().click({ force: true })
await page.waitForTimeout(200)
if (!(await catalog.locator('text=Favorites').isVisible())) errors.push('favorites section missing')
await catalog.locator('input').fill('')
await page.waitForTimeout(300)
await page.screenshot({ path: `${shots}/s2_favorited.png` })

// 4. Drag a catalog card into p1's discard pile
await catalog.locator('input').fill('potion')
await page.waitForTimeout(400)
const potion = catalog.locator('img[alt="Potion"]').first()
const pSrc = await potion.boundingBox()
const discard = await page.locator('div[title="Click to view discard pile"]').nth(1).boundingBox()
await page.mouse.move(pSrc.x + pSrc.width / 2, pSrc.y + pSrc.height / 2)
await page.mouse.down()
await page.mouse.move(discard.x + discard.width / 2, discard.y + discard.height / 2, { steps: 15 })
await page.mouse.up()
await page.waitForTimeout(300)
const discarded = await page.evaluate(() => window.__game.state.p1.discard.some((c) => c.name === 'Potion'))
console.log('catalog drag to discard:', discarded)
if (!discarded) errors.push('catalog drag-to-discard failed')

// 5. Switch back to the game log via its tab
await page.getByRole('button', { name: 'Game Log' }).click()
await page.waitForTimeout(200)
if (await catalog.isVisible()) errors.push('catalog did not close when Game Log tab selected')
if (!(await page.locator('text=Sandbox started').isVisible())) errors.push('game log not visible after tab switch')

// 6. Turn-based toggle: enter, verify off-turn actions are rejected, exit
await page.getByTestId('turn-rules-toggle').click()
await page.waitForTimeout(200)
const onLabel = await page.getByTestId('turn-rules-toggle').innerText()
if (!/exit turn based/i.test(onLabel)) errors.push('toggle did not switch to Exit Turn Based')
const rejected = await page.evaluate(() => {
  const before = window.__game.state.log.length
  window.__game.dispatch({ type: 'end-turn', actor: 'p2' }) // p1's turn: must be rejected
  return new Promise((res) => setTimeout(() => {
    const s = window.__game.state
    res(s.turnPlayer === 'p1' && s.log.length > before)
  }, 100))
})
console.log('off-turn action rejected under turn rules:', rejected)
if (!rejected) errors.push('turn rules did not reject off-turn action')
await page.screenshot({ path: `${shots}/s3_turn_based.png` })
await page.getByTestId('turn-rules-toggle').click()
await page.waitForTimeout(200)
const offLabel = await page.getByTestId('turn-rules-toggle').innerText()
if (!/enter turn based/i.test(offLabel)) errors.push('toggle did not switch back')

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'Sandbox tools UI smoke passed, no console errors')
await browser.close()
process.exit(errors.length ? 1 : 0)

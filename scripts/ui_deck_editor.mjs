// UI smoke test for the Deck Editor and "Use Own Deck" flow: build a deck
// via clicks, auto-fill energy to 60, save, then pick it in Quick Play and
// verify the match starts with it. Run with the dev server on :5199.
import { chromium } from 'playwright'
import fs from 'fs'

const shots = 'scripts/shots'
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

// deterministic runs: fx off, and start from a clean deck store
await page.addInitScript(() => {
  localStorage.setItem('ppc-settings', JSON.stringify({ animations: false, sound: false, volume: 0 }))
  localStorage.removeItem('ppc-decks')
})
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })

// 1. Enter the editor from the main menu
await page.getByRole('button', { name: 'Deck Editor' }).click()
await page.waitForSelector('[data-testid="deck-count"]')
await page.screenshot({ path: `${shots}/d1_editor_open.png` })

// 2. Add 4 Ponyta, 4 Growlithe, 4 Bill by clicking browser tiles
const addCopies = async (name, n) => {
  await page.locator('input[placeholder="Search cards…"]').fill(name)
  const tile = page.locator(`[data-browser-card="${name}"]`)
  await tile.waitFor({ state: 'visible' })
  for (let i = 0; i < n; i++) await tile.click()
}
await addCopies('Ponyta', 4)
await addCopies('Growlithe', 4)
await addCopies('Bill', 4)
let count = await page.getByTestId('deck-count').innerText()
console.log('after adds:', count)
if (count.trim() !== '12/60') errors.push(`expected 12/60 after adds, got ${count}`)

// 3. Copy limit: a 5th click on Ponyta must not add a copy
await addCopies('Ponyta', 1)
count = await page.getByTestId('deck-count').innerText()
if (count.trim() !== '12/60') errors.push(`copy limit not enforced, count ${count}`)

// 3b. Set filter: the Jungle chip hides Base cards; add a Jungle card
await page.getByTestId('editor-set-jungle').click()
await page.locator('input[placeholder="Search cards…"]').fill('Ponyta')
await page.waitForTimeout(150)
if (await page.locator('[data-browser-card="Ponyta"]').count()) errors.push('Base card visible under Jungle filter')
await addCopies('Snorlax', 1) // Snorlax is Jungle-only
await page.getByTestId('editor-set-all').click()
count = await page.getByTestId('deck-count').innerText()
console.log('after Jungle add:', count)
if (count.trim() !== '13/60') errors.push(`expected 13/60 after Jungle add, got ${count}`)

// 4. Validation should currently complain about the size
let validation = await page.getByTestId('deck-validation').innerText()
if (!/exactly 60/.test(validation)) errors.push('missing size validation message')

// 5. Auto-fill energy tops the deck to 60 (fire pokemon -> Fire Energy)
await page.getByRole('button', { name: 'Auto-fill Energy' }).click()
count = await page.getByTestId('deck-count').innerText()
console.log('after auto-fill:', count)
if (count.trim() !== '60/60') errors.push(`auto-fill did not reach 60, got ${count}`)
validation = await page.getByTestId('deck-validation').innerText()
if (!/Match legal/.test(validation)) errors.push(`deck not legal after auto-fill: ${validation}`)
if (!(await page.locator('text=Fire Energy').first().isVisible())) errors.push('Fire Energy missing from deck panel')

// 6. Saving with no name auto-assigns a generic unique one
await page.getByRole('button', { name: /^Save/ }).click()
await page.waitForTimeout(200)
const autoName = await page.locator('input[placeholder="Deck name…"]').inputValue()
console.log('auto-assigned name:', autoName)
if (autoName !== 'Deck 1') errors.push(`expected auto name "Deck 1", got "${autoName}"`)

// 7. Rename the deck and save again (same deck, updated name)
await page.locator('input[placeholder="Deck name…"]').fill('Smoke Deck')
await page.getByRole('button', { name: /^Save/ }).click()
await page.waitForTimeout(200)
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ppc-decks') ?? '[]'))
if (saved.length !== 1) errors.push(`expected 1 saved deck after rename, got ${saved.length}`)
console.log('saved decks:', saved.map((d) => d.name))
if (!saved.some((d) => d.name === 'Smoke Deck')) errors.push('deck not persisted to localStorage')
await page.screenshot({ path: `${shots}/d2_deck_saved.png` })

// 8. Back to menu -> Quick Play: the saved deck appears under Use Own Deck
await page.getByRole('button', { name: '← Menu' }).click()
await page.getByRole('button', { name: 'Quick Play' }).click()
await page.getByTestId('qp-group-custom').click()
await page.waitForSelector('text=Use Own Deck')
const tile = page.getByRole('button', { name: /Smoke Deck/ })
if (!(await tile.isVisible())) errors.push('saved deck tile missing in Quick Play')
await tile.click()
await page.screenshot({ path: `${shots}/d3_own_deck_picker.png` })

// 9. Start the match and verify it uses the custom deck
await page.getByRole('button', { name: 'Start Match' }).click()
await page.waitForSelector('text=/Match started: Smoke Deck vs/', { timeout: 5000 })
const handCards = await page.locator('img[alt]:not([alt=""])').count()
console.log('match started with Smoke Deck; visible card faces:', handCards)
if (handCards < 1) errors.push('no cards rendered after match start')
await page.screenshot({ path: `${shots}/d4_match_with_own_deck.png` })

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'Deck editor UI smoke passed, no console errors')
await browser.close()
process.exit(errors.length ? 1 : 0)

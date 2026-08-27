// UI smoke test for Story Mode: enter Kanto, pick a starter, check the hub
// steppers/locks, buy + open a booster in the shop, check the collection-
// constrained deck editor, then launch (and forfeit) the first battle.
// Run with the dev server on :5199.
import { chromium } from 'playwright'
import fs from 'fs'

const shots = 'scripts/shots'
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
// remote art CDNs occasionally 503; a flaky image is not an app failure
page.on(
  'console',
  (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push('console: ' + m.text())
)

// deterministic runs: fx off, fresh profile and deck store
await page.addInitScript(() => {
  localStorage.setItem('ppc-settings', JSON.stringify({ animations: false, sound: false, volume: 0 }))
  localStorage.removeItem('ppc-decks')
  localStorage.removeItem('ppc-profile')
})
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })

// click through a DialogueBox until its final button appears, then press it
const finishDialogue = async () => {
  await page.waitForSelector('[data-testid="dialogue"]')
  for (let i = 0; i < 12; i++) {
    if (await page.getByTestId('dialogue-done').count()) break
    await page.getByTestId('dialogue-line').click()
    await page.waitForTimeout(80)
  }
  await page.getByTestId('dialogue-done').click()
  await page.waitForTimeout(150)
}

// 1. Main menu -> Story Mode -> Kanto
await page.getByTestId('menu-story').click()
await page.waitForSelector('[data-testid="story-kanto"]')
await page.screenshot({ path: `${shots}/s1_story_select.png` })
await page.getByTestId('story-kanto').click()

// 2. Starter pick (fresh profile) -> Blazing Fists
await page.waitForSelector('[data-testid="starter-kanto-fire"]')
await page.screenshot({ path: `${shots}/s2_starter_pick.png` })
await page.getByTestId('starter-kanto-fire').click()
await finishDialogue() // Professor Oak's welcome

// 3. Hub: coins granted, first node open, second locked, later area locked
await page.waitForSelector('[data-testid="area-pewter"]')
await page.screenshot({ path: `${shots}/s3_hub.png` })
const coins = await page.getByTestId('coins').first().innerText()
if (!coins.includes('250')) errors.push(`expected 250 starting coins, got "${coins}"`)
if (!(await page.getByTestId('node-pewter-1').isEnabled())) errors.push('first node should be unlocked')
if (await page.getByTestId('node-pewter-2').isEnabled()) errors.push('second node should be locked')
if (await page.getByTestId('node-cerulean-1').isEnabled()) errors.push('second area should be locked')
const ready = await page.locator('text=Ready to battle').count()
if (!ready) errors.push('starter deck not battle-ready in the hub')
// mystery + boss nodes stay hidden
const hubText = await page.getByTestId('area-pewter').innerText()
if (!hubText.includes('???')) errors.push('mystery/boss node names should be hidden')

// 4. Shop: preview, buy, open a Base Set booster
await page.getByTestId('to-shop').click()
await page.waitForSelector('[data-testid="pack-base1"]')
await page.getByTestId('preview-base1').click()
await page.waitForSelector('[data-testid="pack-preview"]')
await page.screenshot({ path: `${shots}/s4_pack_preview.png` })
await page.getByRole('button', { name: 'Close preview' }).click()
await page.getByTestId('buy-base1').click()
await page.waitForTimeout(150)
const coinsAfterBuy = await page.getByTestId('coins').first().innerText()
if (!coinsAfterBuy.includes('150')) errors.push(`expected 150 coins after buying, got "${coinsAfterBuy}"`)
await page.getByTestId('open-base1').click()
await page.waitForSelector('[data-testid="pack-opening"]')
const cardCount = await page.locator('[data-testid="pack-card"]').count()
if (cardCount !== 5) errors.push(`expected 5 cards in the pack, got ${cardCount}`)
if (await page.getByTestId('pack-done').isEnabled()) errors.push('Done should be disabled before all cards are flipped')
await page.getByTestId('pack-flip-all').click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${shots}/s5_pack_opened.png` })
await page.getByTestId('pack-done').click()
await page.getByRole('button', { name: '← Back' }).click()

// 5. Deck editor: story decks only, unowned cards blocked by the collection
await page.getByTestId('to-editor').click()
await page.waitForSelector('[data-testid="deck-count"]')
await page.screenshot({ path: `${shots}/s6_story_editor.png` })
const deckCount = await page.getByTestId('deck-count').innerText()
if (deckCount.trim() !== '60/60') errors.push(`starter deck should load at 60/60, got ${deckCount}`)
// Charizard isn't in the starter collection (unless the booster pulled one).
// The Owned filter is on by default, so an unowned card must be hidden until
// the filter is toggled off — and even then clicks can't exceed what we own.
const owned = await page.evaluate(() => (JSON.parse(localStorage.getItem('ppc-profile')).collection['Charizard'] ?? 0))
await page.locator('input[placeholder="Search cards…"]').fill('Charizard')
await page.waitForTimeout(150)
const zardTile = page.locator('[data-browser-card="Charizard"]')
if (owned === 0 && (await zardTile.count())) errors.push('unowned card visible with the Owned filter on')
await page.getByTestId('editor-owned').click() // toggle Owned off
await page.waitForTimeout(150)
if (!(await zardTile.count())) errors.push('card missing after toggling the Owned filter off')
if (await zardTile.count()) {
  for (let i = 0; i < 5; i++) await zardTile.click({ force: true })
  const after = await page.getByTestId('deck-count').innerText()
  const added = parseInt(after) - 60
  if (added > owned) errors.push(`added ${added} Charizard while owning ${owned}`)
}
await page.getByRole('button', { name: '← Menu' }).click()

// 6. Challenge the first node: intro dialogue then the match with a portrait
await page.waitForSelector('[data-testid="node-pewter-1"]')
await page.getByTestId('node-pewter-1').click()
await page.waitForSelector('[data-testid="dialogue"]')
await page.screenshot({ path: `${shots}/s7_intro_dialogue.png` })
await finishDialogue() // ends with "Battle!"
await page.waitForSelector('text=vs Youngster Joey')
await page.waitForTimeout(800)
await page.screenshot({ path: `${shots}/s8_story_battle.png` })

// 7. Forfeit back to the hub: no rewards, node still unbeaten
await page.getByRole('button', { name: '← Forfeit' }).click()
await page.waitForSelector('[data-testid="area-pewter"]')
const beaten = await page.getByTestId('node-pewter-1').getAttribute('data-beaten')
if (beaten !== '0') errors.push('forfeit should not beat the node')
await page.screenshot({ path: `${shots}/s9_back_to_hub.png` })

await browser.close()
if (errors.length) {
  console.error('UI STORY FAILURES:')
  for (const e of errors) console.error(' -', e)
  process.exit(1)
}
console.log('ui_story: all checks passed')

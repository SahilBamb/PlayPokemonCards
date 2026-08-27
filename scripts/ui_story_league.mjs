// UI smoke test for the League Reborn story: three stories on the select
// screen, gym-trainee starters, the 8-area hub, Gym Heroes/Challenge boosters
// with the League Quartermaster in the shop, and the gymEra deck editor pool.
// Run with the dev server on :5199.
import { chromium } from 'playwright'
import fs from 'fs'

const shots = 'scripts/shots'
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on(
  'console',
  (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push('console: ' + m.text())
)

await page.addInitScript(() => {
  localStorage.setItem('ppc-settings', JSON.stringify({ animations: false, sound: false, volume: 0 }))
  localStorage.removeItem('ppc-decks')
  localStorage.removeItem('ppc-profile')
})
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })

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

// 1. Story select lists all three stories
await page.getByTestId('menu-story').click()
await page.waitForSelector('[data-testid="story-league"]')
for (const id of ['kanto', 'rocket', 'league']) {
  if (!(await page.getByTestId(`story-${id}`).count())) errors.push(`story ${id} missing from story select`)
}
await page.screenshot({ path: `${shots}/l1_story_select.png` })
await page.getByTestId('story-league').click()

// 2. Gym trainee starter decks
await page.waitForSelector('[data-testid="starter-league-rock"]')
for (const id of ['league-rock', 'league-wave', 'league-flame']) {
  if (!(await page.getByTestId(`starter-${id}`).count())) errors.push(`starter ${id} missing`)
}
await page.screenshot({ path: `${shots}/l2_starters.png` })
await page.getByTestId('starter-league-wave').click()
await finishDialogue()

// 3. Hub: 8 areas, first node open, later areas locked, mystery names hidden
await page.waitForSelector('[data-testid="area-pewter"]')
await page.screenshot({ path: `${shots}/l3_hub.png` })
if (!(await page.getByTestId('node-lg-pewter-1').isEnabled())) errors.push('first league node should be unlocked')
if (await page.getByTestId('node-lg-cerulean-1').isEnabled()) errors.push('second league area should be locked')
const hubText = await page.getByTestId('area-pewter').innerText()
if (!hubText.includes('???')) errors.push('mystery node names should be hidden in Pewter')
for (const area of ['pewter', 'cerulean', 'vermilion', 'celadon', 'fuchsia', 'saffron', 'cinnabar', 'viridian']) {
  if (!(await page.getByTestId(`area-${area}`).count())) errors.push(`area ${area} missing from hub`)
}

// 4. Shop: six boosters incl. Gym Heroes/Challenge, League Quartermaster
await page.getByTestId('to-shop').click()
await page.waitForSelector('[data-testid="pack-gym2"]')
for (const id of ['base1', 'jungle', 'fossil', 'rocket', 'gym1', 'gym2']) {
  if (!(await page.getByTestId(`pack-${id}`).count())) errors.push(`pack ${id} missing from the league shop`)
}
const shopText = await page.locator('body').innerText()
if (!/league quartermaster/i.test(shopText)) errors.push('league shopkeeper not shown')
await page.getByTestId('preview-gym2').click()
await page.waitForSelector('[data-testid="pack-preview"]')
if (!(await page.locator(`[data-testid="pack-preview"] [title="Blaine's Charizard"]`).count()))
  errors.push('gym2 pack preview missing Gym Challenge cards')
await page.screenshot({ path: `${shots}/l4_shop.png` })
await page.getByRole('button', { name: 'Close preview' }).click()
// buy + open a Gym Heroes booster
await page.getByTestId('buy-gym1').click()
await page.getByTestId('open-gym1').click()
await page.waitForSelector('[data-testid="pack-opening"]')
const cardCount = await page.locator('[data-testid="pack-card"]').count()
if (cardCount !== 5) errors.push(`expected 5 cards in the gym1 pack, got ${cardCount}`)
await page.getByTestId('pack-flip-all').click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${shots}/l5_pack.png` })
await page.getByTestId('pack-done').click()
await page.getByRole('button', { name: '← Back' }).click()

// 5. Deck editor: gymEra pool has Gym cards, but no vending cards
await page.getByTestId('to-editor').click()
await page.waitForSelector('[data-testid="deck-count"]')
await page.getByTestId('editor-owned').click() // show the full format pool
await page.locator('input[placeholder="Search cards…"]').fill("Sabrina's Alakazam")
await page.waitForTimeout(150)
if (!(await page.locator(`[data-browser-card="Sabrina's Alakazam"]`).count()))
  errors.push('Gym Challenge card missing from the league editor pool')
await page.locator('input[placeholder="Search cards…"]').fill('Gastly (Vending)')
await page.waitForTimeout(150)
if (await page.locator('[data-browser-card="Gastly (Vending)"]').count())
  errors.push('vending card leaked into the gymEra editor pool')
await page.screenshot({ path: `${shots}/l6_editor.png` })
await page.getByRole('button', { name: '← Menu' }).click()

// 6. First battle: gym trainer intro then the match
await page.waitForSelector('[data-testid="node-lg-pewter-1"]')
await page.getByTestId('node-lg-pewter-1').click()
await page.waitForSelector('[data-testid="dialogue"]')
await page.screenshot({ path: `${shots}/l7_dialogue.png` })
await finishDialogue()
await page.waitForSelector('text=vs Camper Liam')
await page.waitForTimeout(800)
await page.screenshot({ path: `${shots}/l8_battle.png` })
await page.getByRole('button', { name: '← Forfeit' }).click()
await page.waitForSelector('[data-testid="area-pewter"]')

await browser.close()
if (errors.length) {
  console.error('UI LEAGUE STORY FAILURES:')
  for (const e of errors) console.error(' -', e)
  process.exit(1)
}
console.log('ui_story_league: all checks passed')

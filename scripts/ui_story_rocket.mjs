// UI smoke test for the Rocket Takeover story: both stories on the select
// screen, rocket starters, the hub areas, the Rocket booster + deserter
// shopkeeper in the shop, and the rocketClassic-filtered deck editor.
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
  for (let i = 0; i < 24; i++) {
    if (await page.getByTestId('dialogue-done').count()) break
    await page.getByTestId('dialogue-line').click()
    await page.waitForTimeout(80)
  }
  await page.getByTestId('dialogue-done').click()
  await page.waitForTimeout(150)
}

// 1. Story select lists both stories
await page.getByTestId('menu-story').click()
await page.waitForSelector('[data-testid="story-kanto"]')
if (!(await page.getByTestId('story-rocket').count())) errors.push('rocket story missing from story select')
await page.screenshot({ path: `${shots}/r1_story_select.png` })
await page.getByTestId('story-rocket').click()
await page.getByTestId('begin-story').click()

// 2. Rocket starter decks
await page.waitForSelector('[data-testid="starter-rocket-volt"]')
for (const id of ['rocket-volt', 'rocket-sludge', 'rocket-ember']) {
  if (!(await page.getByTestId(`starter-${id}`).count())) errors.push(`starter ${id} missing`)
}
await page.screenshot({ path: `${shots}/r2_starters.png` })
await page.getByTestId('starter-rocket-sludge').click()
await finishDialogue()

// 3. Hub: rebel hideout open, later areas locked, portraits render
await page.waitForSelector('[data-testid="area-hideout"]')
await page.screenshot({ path: `${shots}/r3_hub.png` })
if (!(await page.getByTestId('node-hideout-1').isEnabled())) errors.push('first rocket node should be unlocked')
await page.getByTestId('area-harbor').click()
if (await page.getByTestId('node-harbor-1').isEnabled()) errors.push('second rocket area should be locked')
await page.getByTestId('area-hideout').click()
const hubText = await page.locator('.atlas-encounter-panel').innerText()
if (!hubText.includes('???')) errors.push('mystery/boss names should be hidden in the hideout')
for (const area of ['hideout', 'harbor', 'corner', 'lab', 'silph', 'hq']) {
  if (!(await page.getByTestId(`area-${area}`).count())) errors.push(`area ${area} missing from hub`)
}

// 4. Shop: Team Rocket booster on the shelf, deserter shopkeeper
await page.getByTestId('to-shop').click()
await page.waitForSelector('[data-testid="pack-rocket"]')
// the name plate renders uppercase via CSS, so compare case-insensitively
const shopText = await page.locator('body').innerText()
if (!/deserter wanda/i.test(shopText)) errors.push('rocket shopkeeper not shown')
await page.getByTestId('preview-rocket').click()
await page.waitForSelector('[data-testid="pack-preview"]')
// cards render as <img title={name}>, so look for the title attribute
if (!(await page.locator('[data-testid="pack-preview"] [title="Dark Charizard"]').count()))
  errors.push('rocket pack preview missing Team Rocket cards')
await page.screenshot({ path: `${shots}/r4_shop.png` })
await page.getByRole('button', { name: 'Close preview' }).click()
// buy + open a rocket booster
await page.getByTestId('buy-rocket').click()
await page.getByTestId('open-rocket').click()
await page.waitForSelector('[data-testid="pack-opening"]')
const cardCount = await page.locator('[data-testid="pack-card"]').count()
if (cardCount !== 5) errors.push(`expected 5 cards in the rocket pack, got ${cardCount}`)
await page.getByTestId('pack-flip-all').click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${shots}/r5_pack.png` })
await page.getByTestId('pack-done').click()
await page.getByTestId('to-journey').click()

// 5. Deck editor: rocketClassic format — Team Rocket cards visible with the
// Owned filter off, Gym-set cards still excluded
await page.getByTestId('to-editor').click()
await page.waitForSelector('[data-testid="deck-count"]')
await page.getByTestId('editor-owned').click() // show the full format pool
await page.locator('input[placeholder="Search cards…"]').fill('Dark Alakazam')
await page.waitForTimeout(150)
if (!(await page.locator('[data-browser-card="Dark Alakazam"]').count())) errors.push('Team Rocket card missing from the rocket editor pool')
await page.locator('input[placeholder="Search cards…"]').fill("Sabrina's Alakazam")
await page.waitForTimeout(150)
if (await page.locator('[data-browser-card^="Sabrina"]').count()) errors.push('Gym-set card leaked into the rocketClassic editor pool')
await page.screenshot({ path: `${shots}/r6_editor.png` })
await page.getByRole('button', { name: '← Menu' }).click()

// 6. First battle launches with the rebel intro dialogue
await page.waitForSelector('[data-testid="node-hideout-1"]')
await page.getByTestId('node-hideout-1').click()
await page.waitForSelector('[data-testid="dialogue"]')
await page.screenshot({ path: `${shots}/r7_dialogue.png` })
await finishDialogue()
await page.waitForSelector('text=vs Rebel Kenji')
await page.waitForTimeout(800)
await page.screenshot({ path: `${shots}/r8_battle.png` })
await page.getByRole('button', { name: '← Forfeit' }).click()
await page.waitForSelector('[data-testid="area-hideout"]')

await browser.close()
if (errors.length) {
  console.error('UI ROCKET STORY FAILURES:')
  for (const e of errors) console.error(' -', e)
  process.exit(1)
}
console.log('ui_story_rocket: all checks passed')

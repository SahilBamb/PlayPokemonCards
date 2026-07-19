// End-to-end scenario: build a small board via the sandbox spawn helper and
// real drag/click input, then run an attack with an energy-discard choice.
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
await page.waitForTimeout(600)

const logTail = () => page.evaluate(() => window.__game.state.log.slice(-4))

// Stage the board through spawn + drop dispatches (drag itself is covered by ui_check.mjs):
// p1: Charmander active with 2 fire energy; p2: Machop active.
const stage = async (name, player, destId) => {
  await page.evaluate(([n, p]) => window.__game.spawn(n, p), [name, player])
  await page.waitForTimeout(80)
  await page.evaluate(([p, id]) => {
    const g = window.__game
    const card = g.state[p].hand[g.state[p].hand.length - 1]
    g.dispatch({ type: 'drop', source: { from: 'hand', player: p, uid: card.uid }, dest: { player: p, id } })
  }, [player, destId])
  await page.waitForTimeout(80)
}
await stage('Charmander', 'p1', 0)
await stage('Machop', 'p2', 0)
await stage('Fire Energy', 'p1', 0)
await stage('Fire Energy', 'p1', 0)

await page.waitForTimeout(300)
await page.screenshot({ path: `${shots}/4_board_setup.png` })

const board = await page.evaluate(() => ({
  p1Active: window.__game.state.p1.mon[0]?.name,
  p1Energy: window.__game.state.p1.mon[0]?.energyAttached.length,
  p2Active: window.__game.state.p2.mon[0]?.name,
}))
console.log('board:', JSON.stringify(board))
if (board.p1Active !== 'Charmander' || board.p1Energy !== 2 || board.p2Active !== 'Machop') {
  errors.push('board setup failed: ' + JSON.stringify(board))
}

// Ember: cost discard modal should appear
await page.getByRole('button', { name: /Ember/ }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${shots}/5_energy_choice.png` })
const prompt = await page.locator('.fixed.inset-0 h2').first().innerText().catch(() => '')
console.log('modal prompt:', prompt)
if (!prompt.toLowerCase().includes('energy')) errors.push('energy choice modal missing')

await page.locator('.fixed.inset-0 div.cursor-pointer:has-text("Fire Energy")').first().click()
await page.getByRole('button', { name: /Confirm/ }).click()
await page.waitForTimeout(300)

const after = await page.evaluate(() => ({
  machopDc: window.__game.state.p2.mon[0]?.dc,
  p1Energy: window.__game.state.p1.mon[0]?.energyAttached.length,
}))
console.log('after Ember:', JSON.stringify(after), await logTail())
if (after.machopDc !== 30 || after.p1Energy !== 1) errors.push('Ember result wrong: ' + JSON.stringify(after))

// Retreat flow: bench a second pokemon, then retreat (cost 1 -> energy choice, then bench click)
await stage('Squirtle', 'p1', 1)
await page.locator('div.border-r-2').getByRole('button', { name: /Retreat/ }).click()
await page.waitForTimeout(300)
// pay 1 energy
await page.locator('.fixed.inset-0 div.cursor-pointer:has-text("Fire Energy")').first().click()
await page.getByRole('button', { name: /^Confirm$/ }).click()
await page.waitForTimeout(300)
// choose bench pokemon (highlighted)
await page.screenshot({ path: `${shots}/6_retreat_target.png` })
await page.locator('div.ring-4 img').first().click()
await page.waitForTimeout(300)

const finalBoard = await page.evaluate(() => ({
  active: window.__game.state.p1.mon[0]?.name,
  bench1: window.__game.state.p1.mon[1]?.name,
}))
console.log('after retreat:', JSON.stringify(finalBoard))
if (finalBoard.active !== 'Squirtle') errors.push('retreat failed: ' + JSON.stringify(finalBoard))

await page.screenshot({ path: `${shots}/7_final.png` })
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'Scenario passed, no console errors')
await browser.close()
process.exit(errors.length ? 1 : 0)

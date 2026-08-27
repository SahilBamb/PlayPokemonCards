// UI smoke test for battle fx: coin flip overlay blocks play and resolves,
// status/hit animations run, and the settings toggles disable everything.
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

// animations on, sound off (no audio hardware in CI)
await page.addInitScript(() => localStorage.setItem('ppc-settings', JSON.stringify({ animations: true, sound: false, volume: 0.5 })))
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Sandbox' }).click()
await page.waitForTimeout(400)

// Stage a fight: Doduo (Fury Attack, 2 flips) vs Onix
await page.evaluate(() => {
  const d = window.__game.dispatch
  d({ type: 'drop', source: { from: 'catalog', name: 'Doduo' }, dest: { player: 'p1', id: 0 } })
  d({ type: 'drop', source: { from: 'catalog', name: 'Double Colorless Energy' }, dest: { player: 'p1', id: 0 } })
  d({ type: 'drop', source: { from: 'catalog', name: 'Onix' }, dest: { player: 'p2', id: 0 } })
})
await page.waitForTimeout(200)

// 1. Attack: fx queue must block the game, coin overlay must appear
await page.evaluate(() => window.__game.dispatch({ type: 'attack', player: 'p1', id: 0, attackName: 'Fury Attack' }))
await page
  .waitForFunction(() => window.__game.state.fxQueue.length > 0, null, { timeout: 3000 })
  .catch(() => errors.push('fxQueue never filled after attack — game did not pause'))

await page.locator('[data-testid="coin-overlay"]').waitFor({ state: 'visible', timeout: 5000 })
console.log('coin overlay appeared')
await page.waitForTimeout(1100) // mid-flip
await page.screenshot({ path: `${shots}/f1_coins.png` })

// 2. Overlay clears and the attack finishes resolving
await page.locator('[data-testid="coin-overlay"]').waitFor({ state: 'hidden', timeout: 10000 })
await page.waitForFunction(() => {
  const s = window.__game.state
  return s.fxQueue.length === 0 && s.effectsQueue.length === 0
}, null, { timeout: 10000 })
const flipLogged = await page.evaluate(() => window.__game.state.log.some((l) => l.startsWith('Coin flip:')))
if (!flipLogged) errors.push('coin flip missing from log after fx')
console.log('attack resolved after coin overlay')

// 3. Status fx: Toxic poison shows the status badge overlay on the target
await page.evaluate(() => {
  const d = window.__game.dispatch
  d({ type: 'drop', source: { from: 'catalog', name: 'Nidoking' }, dest: { player: 'p1', id: 1 } })
  for (let i = 0; i < 3; i++) d({ type: 'drop', source: { from: 'catalog', name: 'Grass Energy' }, dest: { player: 'p1', id: 1 } })
})
// make Nidoking active by clearing p1 active first (KO'd Doduo may still be there); use bench attack? Attacks
// only come from any slot in sandbox, so attack straight from the bench slot.
await page.evaluate(() => window.__game.dispatch({ type: 'attack', player: 'p1', id: 1, attackName: 'Toxic' }))
await page.waitForTimeout(700) // lunge (480ms) then hit starts
await page.screenshot({ path: `${shots}/f2_status.png` })
await page.waitForFunction(() => {
  const s = window.__game.state
  return s.fxQueue.length === 0 && s.effectsQueue.length === 0 && s.p2.mon[0]?.poisoned
}, null, { timeout: 10000 })
console.log('poison status fx resolved, target poisoned')

// 4. Settings: disable animations via the gear, attacks resolve instantly
await page.locator('button[title="Settings"]').click()
await page.locator('[data-testid="settings-modal"]').waitFor({ state: 'visible' })
await page.screenshot({ path: `${shots}/f3_settings.png` })
await page.getByRole('switch', { name: 'Battle animations' }).click()
await page.locator('[data-testid="settings-modal"] button:has-text("×")').click()
// wait until the engine has picked up the fx-off setting
await page.waitForFunction(() => window.__game.state.fxEnabled === false, null, { timeout: 3000 })
const instant = await page.evaluate(async () => {
  const d = window.__game.dispatch
  // fresh high-HP defender (the previous one may have been KO'd)
  if (!window.__game.state.p2.mon[0]) {
    d({ type: 'drop', source: { from: 'catalog', name: 'Chansey' }, dest: { player: 'p2', id: 0 } })
    await new Promise((r) => setTimeout(r, 100))
  }
  const before = window.__game.state.p2.mon[0].dc ?? 0
  const logBefore = window.__game.state.log.length
  d({ type: 'attack', player: 'p1', id: 1, attackName: 'Toxic' })
  await new Promise((r) => setTimeout(r, 300))
  const s = window.__game.state
  const newLog = s.log.slice(logBefore)
  // instant = no fx pause and the attack fully resolved (damage landed, or the
  // defender was outright KO'd by it)
  const landed = (s.p2.mon[0]?.dc ?? 0) > before || (!s.p2.mon[0] && newLog.some((l) => l.includes('Knocked Out')))
  return {
    ok: s.fxQueue.length === 0 && s.effectsQueue.length === 0 && landed,
    fxEnabled: s.fxEnabled,
    fxQueue: s.fxQueue.map((f) => f.kind),
    before,
    after: s.p2.mon[0]?.dc ?? null,
    logTail: s.log.slice(-4),
  }
})
if (!instant.ok) errors.push('attack did not resolve instantly with animations disabled: ' + JSON.stringify(instant))
console.log('animations off: attack resolved instantly')

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'FX UI smoke passed, no console errors')
await browser.close()
process.exit(errors.length ? 1 : 0)

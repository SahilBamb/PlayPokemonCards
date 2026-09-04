// UI smoke test: the Quick Play picker shows the new deck groups and a new
// deck starts a playable match. Run with the dev server on :5199.
import { chromium } from 'playwright'
import fs from 'fs'

const shots = 'scripts/shots'
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

await page.addInitScript(() => localStorage.setItem('ppc-settings', JSON.stringify({ animations: false, sound: false, volume: 0 })))
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Quick Play' }).click()
await page.waitForTimeout(400)

for (const [id, label] of [
  ['baserocket', '2000 Base–Rocket'],
  ['basegym', '2000 Base–Gym'],
  ['prop153', 'Prop 15/3 (2000)'],
  ['originalrules', 'Original Rules (Japan)'],
]) {
  const tab = page.getByTestId(`qp-group-${id}`)
  if (!(await tab.count())) errors.push(`group ${label} missing`)
  else await tab.click()
  const heading = await page.getByRole('heading', { name: label }).isVisible().catch(() => false)
  console.log(`group "${label}":`, heading ? 'visible' : 'MISSING')
  if (!heading) errors.push(`group ${label} content missing`)
}

// Pick a new deck and start a match
await page.getByTestId('qp-group-basegym').click()
await page.locator('text=Wigglytuff Trapper').scrollIntoViewIfNeeded()
await page.locator('text=Wigglytuff Trapper').click()
await page.screenshot({ path: `${shots}/qp_new_groups.png` })
await page.getByRole('button', { name: /Start Match/i }).click()
await page.waitForTimeout(1500)
const prompt = await page.locator('body').innerText()
if (!/active|place|choose/i.test(prompt)) errors.push('match did not reach setup prompt')
await page.screenshot({ path: `${shots}/qp_trapper_match.png` })
console.log('match started:', /active|place|choose/i.test(prompt))

await browser.close()
if (errors.length) {
  console.error('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('ui_new_decks: all good')

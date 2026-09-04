// Dark-mode UI smoke: gameplay board defaults to dark; the Settings modal
// exposes a "Dark mode" toggle that switches the board back to light.
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

// deterministic runs: disable battle animations and sound (theme omitted → dark default)
await page.addInitScript(() => localStorage.setItem('ppc-settings', JSON.stringify({ animations: false, sound: false, volume: 0 })))
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)

// Default is dark: <html> carries .dark even for pre-existing saved settings
let hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
if (!hasDark) errors.push('html missing .dark class by default')

// Start a match and check the board surface color
await page.getByRole('button', { name: 'Quick Play' }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Start Match' }).click()
await page.waitForTimeout(600)

const boardBg = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="hand-p1"]')?.parentElement
    return el ? getComputedStyle(el).backgroundColor : null
  })

// Lightness in [0,1]: oklab reports L directly; rgb() gets a rough luma.
const lightness = (s) => {
  const nums = (s?.match(/[\d.]+/g) ?? []).map(Number)
  return s?.startsWith('oklab') || s?.startsWith('oklch') ? nums[0] : (nums[0] + nums[1] + nums[2]) / (3 * 255)
}
const darkBg = await boardBg()
console.log('board bg (dark):', darkBg)
if (lightness(darkBg) > 0.4) errors.push(`board not dark by default: ${darkBg}`)
await page.screenshot({ path: `${shots}/dk1_board_dark.png` })

// Toggle light mode through Settings
await page.getByRole('button', { name: 'Settings' }).click()
await page.waitForSelector('[data-testid="settings-modal"]')
await page.getByRole('switch', { name: 'Dark mode' }).click()
await page.screenshot({ path: `${shots}/dk2_settings.png` })
await page.locator('[data-testid="settings-modal"] button', { hasText: '×' }).click()
await page.waitForTimeout(200)

hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
if (hasDark) errors.push('html still .dark after switching to light')
const lightBg = await boardBg()
console.log('board bg (light):', lightBg)
if (lightness(lightBg) < 0.8) errors.push(`board not light after toggle: ${lightBg}`)
await page.screenshot({ path: `${shots}/dk3_board_light.png` })

// Setting persists in localStorage
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ppc-settings')))
if (saved.theme !== 'light') errors.push('theme not persisted: ' + JSON.stringify(saved))

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'Dark mode UI smoke passed, no console errors')
await browser.close()
process.exit(errors.length ? 1 : 0)

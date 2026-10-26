// Classic appearance smoke: dark default, light and transparent board surfaces.
// Override CLASSIC_URL when checking another local server or a branch preview.
import { chromium } from 'playwright'
import fs from 'fs'

const shots = 'docs/pixel-grove/screenshots/classic'
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
// Exclude third-party telemetry from deterministic UI checks.
await page.route(/https:\/\/(all-sites-analytics\.pages\.dev\/a\.js|static\.cloudflareinsights\.com\/beacon\.min\.js)/, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

// deterministic runs: disable battle animations and sound (theme omitted → dark default)
await page.addInitScript(() => localStorage.setItem('ppc-settings', JSON.stringify({ animations: false, sound: false, volume: 0 })))
await page.goto(process.env.CLASSIC_URL || 'http://127.0.0.1:5187/classic', { waitUntil: 'networkidle' })
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
await page.getByRole('button', { name: 'Light appearance', exact: true }).click()
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

await page.getByRole('button', { name: 'Settings', exact: true }).click()
await page.getByRole('button', { name: 'Transparent appearance', exact: true }).click()
await page.locator('[data-testid="settings-modal"] button', { hasText: '×' }).click()
const transparentBg = await boardBg()
console.log('board bg (transparent):', transparentBg)
if (!transparentBg?.includes('0.2')) errors.push(`board surface not transparent: ${transparentBg}`)
const theme = await page.evaluate(() => JSON.parse(localStorage.getItem('ppc-settings')).theme)
if (theme !== 'transparent') errors.push('transparent appearance did not persist')

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'Dark mode UI smoke passed, no console errors')
await browser.close()
process.exit(errors.length ? 1 : 0)

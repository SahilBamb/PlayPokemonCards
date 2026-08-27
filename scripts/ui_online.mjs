// Online multiplayer UI smoke: boots the real Colyseus server, then drives
// two independent browser contexts through the lobby into a private match.
// Verifies code sharing, cross-client state sync (a card played in one
// browser appears in the other), hidden opponent hands, forfeit flow, and the
// leaderboard screen. Run with the dev server on :5199.
import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppc-online-ui-'))
const { startServer } = await import('../server/index.mjs')
const gameServer = await startServer(2567) // the client's default dev URL

const shots = 'scripts/shots'
fs.mkdirSync(shots, { recursive: true })

const browser = await chromium.launch()
const errors = []
async function newPage(label) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label} console: ${m.text()}`))
  await page.addInitScript(() => localStorage.setItem('ppc-settings', JSON.stringify({ animations: false, sound: false, volume: 0 })))
  await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })
  return page
}

const pageA = await newPage('A')
const pageB = await newPage('B')

// --- Lobby: host creates a private match ---------------------------------
await pageA.getByTestId('menu-online').click()
await pageA.getByTestId('online-name').fill('HostAsh')
await pageA.screenshot({ path: `${shots}/on1_lobby.png` })
await pageA.getByTestId('online-host').click()
await pageA.waitForSelector('[data-testid="private-code"]', { timeout: 10000 })
const code = (await pageA.getByTestId('private-code').innerText()).trim()
console.log('private code:', code)
if (!/^[A-Z0-9]{6}$/.test(code)) errors.push(`bad share code: ${code}`)
await pageA.screenshot({ path: `${shots}/on2_code.png` })

// --- Guest joins with the code -------------------------------------------
await pageB.getByTestId('menu-online').click()
await pageB.getByTestId('online-name').fill('GuestGary')
await pageB.getByTestId('online-code').fill(code)
await pageB.getByTestId('online-join').click()

// Both clients should land on the setup board
for (const [label, page] of [['A', pageA], ['B', pageB]]) {
  const ok = await page.waitForSelector('text=/Setup:/', { timeout: 15000 }).catch(() => null)
  if (!ok) errors.push(`${label} never reached the match setup screen`)
}
const vsA = await pageA.locator('text=vs GuestGary').first().isVisible().catch(() => false)
const vsB = await pageB.locator('text=vs HostAsh').first().isVisible().catch(() => false)
if (!vsA) errors.push('host does not show opponent name')
if (!vsB) errors.push('guest does not show opponent name')

// Opponent hands must be hidden card backs in both browsers
for (const [label, page] of [['A', pageA], ['B', pageB]]) {
  const faces = await page.locator('[data-testid="hand-p2"] img:not([alt=""])').count()
  const backs = await page.locator('[data-testid="hand-p2"] [data-testid="card-back"]').count()
  console.log(`${label}: opponent hand faces=${faces} backs=${backs}`)
  if (faces > 0) errors.push(`${label} can see the opponent's hand`)
  if (backs < 1) errors.push(`${label} shows no opponent card backs`)
}

// --- Cross-client sync: A drags a Basic to its Active spot ----------------
const activeSpot = pageA.locator('div.border-r-2 > div').first()
const handCards = pageA.locator('[data-testid="hand-p1"] img:not([alt=""])')
const handSize = await handCards.count()
for (let i = 0; i < handSize; i++) {
  if ((await activeSpot.locator('img:not([alt=""])').count()) > 0) break
  const card = handCards.nth(i)
  const src = await card.boundingBox()
  const dst = await activeSpot.boundingBox()
  await pageA.mouse.move(src.x + src.width / 2, src.y + src.height / 2)
  await pageA.mouse.down()
  await pageA.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 12 })
  await pageA.mouse.up()
  await pageA.waitForTimeout(350)
}
if ((await activeSpot.locator('img:not([alt=""])').count()) === 0) {
  errors.push('host could not place an Active')
} else {
  // B sees A's Active (opponent side, left board) appear
  const seen = await pageB
    .waitForFunction(() => document.querySelectorAll('div.border-l-2 img:not([alt=""])').length > 0, null, { timeout: 8000 })
    .catch(() => null)
  if (!seen) errors.push("guest never saw the host's Active Pokémon")
}
await pageA.screenshot({ path: `${shots}/on3_match_host.png` })
await pageB.screenshot({ path: `${shots}/on4_match_guest.png` })

// --- Forfeit: B concedes, both get a result ------------------------------
await pageB.getByRole('button', { name: '← Forfeit' }).click()
const overA = await pageA.waitForSelector('[data-testid="game-over"]', { timeout: 10000 }).catch(() => null)
const overB = await pageB.waitForSelector('[data-testid="game-over"]', { timeout: 10000 }).catch(() => null)
if (!overA || !overB) errors.push('game-over overlay missing after forfeit')
const winText = overA ? await pageA.locator('[data-testid="game-over"] h1').innerText() : ''
const loseText = overB ? await pageB.locator('[data-testid="game-over"] h1').innerText() : ''
console.log('after forfeit: host =', winText, '| guest =', loseText)
if (!/win/i.test(winText)) errors.push(`host should have won, saw "${winText}"`)
if (!/lose/i.test(loseText)) errors.push(`guest should have lost, saw "${loseText}"`)
await pageA.screenshot({ path: `${shots}/on5_result.png` })

// Back to the lobby, then check the leaderboard screen renders
await pageA.getByTestId('game-over-exit').click()
await pageA.getByTestId('online-leaderboard').click()
await pageA.waitForTimeout(800)
const lbText = await pageA.innerText('body')
if (!/leaderboard/i.test(lbText)) errors.push('leaderboard screen missing')
if (!/No ranked matches|Trainer/i.test(lbText)) errors.push('leaderboard content missing')
await pageA.screenshot({ path: `${shots}/on6_leaderboard.png` })

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'Online UI smoke passed, no console errors')
await browser.close()
await gameServer.gracefullyShutdown(false).catch(() => {})
process.exit(errors.length ? 1 : 0)

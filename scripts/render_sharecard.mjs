import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.goto(new URL('sharecard.html', import.meta.url).href, { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode()))
  })
  const text = await page.locator('body').innerText()
  if (/[-\u2010-\u2015\u2212]/u.test(text)) throw new Error('Sharing image copy contains a dash')
  await mkdir(resolve(root, 'public/share'), { recursive: true })
  await page.screenshot({ path: resolve(root, 'public/share/classiccards.jpg'), type: 'jpeg', quality: 94, scale: 'css' })
  console.log('Saved public/share/classiccards.jpg at 1200 × 630 pixels')
} finally { await browser.close() }

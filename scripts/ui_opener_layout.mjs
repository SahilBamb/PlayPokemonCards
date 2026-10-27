import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import {
  OPENER_CARDS,
  OPENER_STORAGE_KEY,
  initialOpenerSession,
  openerReducer,
  isShinyPull,
  saleValueCents,
} from "../src/lib/cardOpener.js";

const base = process.env.OPENER_URL || "http://127.0.0.1:5199";
const shots = process.env.OPENER_SHOTS || ".cache/opener-layout";
await mkdir(shots, { recursive: true });
const pool = OPENER_CARDS.filter((card) => card.set === "base1");
const longest = [...pool].sort((a, b) => b.name.length - a.name.length);
const ids = [
  ...longest.slice(0, 9),
  pool.find((card) => saleValueCents(card.id) === null),
  pool.find(isShinyPull),
].map((card) => card.id);
let fixture = openerReducer(initialOpenerSession(), { type: "purchase", id: "base1" });
fixture = openerReducer(fixture, { type: "open", ids, instant: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const cases = [
  { width: 1440, height: 1000, motion: true },
  { width: 390, height: 844, motion: true },
  { width: 360, height: 667, motion: false },
  { width: 768, height: 1024, motion: false, prices: false },
  { width: 844, height: 390, motion: false },
];
const selectors = [
  '[data-testid="opener-modal"]',
  ".co-stack-scene",
  ".co-stack-info",
  ".co-stack-info h3",
  ".co-stack-actions",
  ".co-stack-actions .co-primary",
  ".co-stage-footer",
  ".co-pack-progress",
  ".co-pack-progress > div",
];
async function geometry(page) {
  return page.evaluate((selectors) => selectors.map((selector) => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }), selectors);
}
function stable(actual, expected, label) {
  actual.forEach((box, index) => {
    for (const key of ["x", "y", "width", "height"])
      assert.ok(
        Math.abs(box[key] - expected[index][key]) <= 1,
        `${label}: ${box.selector} ${key} moved from ${expected[index][key]} to ${box[key]}`,
      );
  });
}
try {
  for (const { width, height, motion, prices = true } of cases) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: motion ? "no-preference" : "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/all-sites-analytics\.pages\.dev|cloudflareinsights\.com/, (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
    );
    await page.addInitScript(({ fixture, key, motion, prices }) => {
      if (!sessionStorage.getItem(key))
        sessionStorage.setItem(key, JSON.stringify({ ...fixture, showPrices: prices }));
      localStorage.setItem("ppc-settings", JSON.stringify({
        animations: motion, sound: false, volume: 0, theme: "dark",
      }));
    }, { fixture, key: OPENER_STORAGE_KEY, motion, prices });
    await page.goto(new URL("/card-opener", base).href);
    await page.locator(".co-stack-scene").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(450);
    const initial = await geometry(page);
    for (let index = 0; index < ids.length; index++) {
      if (index) {
        await page.getByRole("button", { name: "Next card", exact: true }).click();
        stable(await geometry(page), initial, `${width}x${height} back ${index}`);
      }
      await page.getByTestId("opener-card").click();
      stable(await geometry(page), initial, `${width}x${height} reveal ${index}`);
      if (index === 0 || index === ids.length - 1) {
        await page.waitForTimeout(450);
        stable(await geometry(page), initial, `${width}x${height} settled ${index}`);
      }
    }
    assert.equal(await page.getByTestId("opener-stage").getAttribute("data-stage"), "complete");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.getByTestId("opener-modal").evaluate((element) => element.scrollWidth <= element.clientWidth));
    const complete = await page.locator(".co-complete-actions").boundingBox();
    const dialog = await page.getByTestId("opener-modal").boundingBox();
    assert.ok(complete.y + complete.height <= dialog.y + dialog.height + 1);
    await page.screenshot({ path: `${shots}/stack-${width}x${height}.png`, scale: "css" });
    await page.getByTestId("opener-modal").getByRole("button", { name: "View/Sell cards", exact: true }).click();
    assert.equal(await page.getByTestId("inventory-card-price").count(), 11);
    await page.getByRole("switch", { name: "Show inventory prices" }).click();
    assert.equal(await page.getByTestId("inventory-card-price").count(), 0);
    await page.getByRole("button", { name: "Back to card shop", exact: true }).click();
    await page.getByRole("button", { name: "View/Sell cards", exact: true }).click();
    assert.equal(await page.getByRole("switch", { name: "Show inventory prices" }).getAttribute("aria-checked"), "false");
    await page.reload();
    await page.getByRole("button", { name: "View/Sell cards", exact: true }).click();
    assert.equal(await page.getByTestId("inventory-card-price").count(), 0);
    const item = page.getByTestId("opened-card").first();
    const balance = () => page.getByTestId("opener-balance").getAttribute("data-cents").then(Number);
    const before = await balance();
    await item.getByTestId("inventory-card").click();
    assert.equal(await balance(), before);
    assert.match(await item.getByTestId("sell-card").innerText(), /Confirm \$/);
    await item.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await item.getAttribute("data-confirming"), "false");
    await item.getByTestId("inventory-card").click();
    await item.getByRole("button", { name: /^Inspect opened/ }).click();
    await page.getByTestId("card-preview").waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await item.getAttribute("data-confirming"), "false");
    assert.equal(await balance(), before);
    await page.getByRole("switch", { name: "Show inventory prices" }).click();
    await page.screenshot({ path: `${shots}/inventory-${width}x${height}.png`, scale: "css" });
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(`${width}x${height}: all eleven stack positions stable, long names, missing quote, holo, completion, price toggle persistence, sale cancellation, and inspection passed`);
    await page.close();
  }
} finally {
  await browser.close();
}

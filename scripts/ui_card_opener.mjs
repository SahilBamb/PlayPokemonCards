import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import {
  OPENER_SETS,
  OPENER_STORAGE_KEY,
  OPENER_WALLET_KEY,
  OPENER_STARTING_BALANCE_CENTS,
  formatValue,
  saleValueCents,
} from "../src/lib/cardOpener.js";

const base = process.env.OPENER_URL || "http://127.0.0.1:5199";
const shots = process.env.OPENER_SHOTS || ".cache/card-opener-ui";
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const profile = JSON.stringify({
  coins: 1234,
  collection: { Pikachu: 2 },
  packs: { base1: 3 },
  stories: {},
});
const errors = [];
const price = (id) => OPENER_SETS.find((set) => set.id === id).priceCents;
const balance = (page) =>
  page.getByTestId("opener-balance").getAttribute("data-cents").then(Number);
const saved = (page) =>
  page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)),
    OPENER_STORAGE_KEY,
  );
async function prepare(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(
    /https:\/\/(all-sites-analytics\.pages\.dev\/a\.js|static\.cloudflareinsights\.com\/beacon\.min\.js)/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "",
      }),
  );
  await page.addInitScript((profile) => {
    if (!localStorage.getItem("ppc-settings"))
      localStorage.setItem(
        "ppc-settings",
        JSON.stringify({
          animations: true,
          sound: false,
          volume: 0,
          theme: "dark",
        }),
      );
    if (!localStorage.getItem("ppc-profile"))
      localStorage.setItem("ppc-profile", profile);
    Math.random = () => 0.1;
  }, profile);
}
async function shot(page, name) {
  await page
    .locator(".co-card-art")
    .evaluateAll((images) =>
      Promise.all(images.map((image) => image.decode().catch(() => {}))),
    );
  await page.waitForTimeout(220);
  await page.screenshot({ path: `${shots}/${name}.png`, scale: "css" });
}
async function stage(page, name) {
  await page
    .locator(`[data-testid="opener-stage"][data-stage="${name}"]`)
    .waitFor({ state: "visible" });
}
async function close(page) {
  await page
    .getByRole("button", { name: "Back to card shop", exact: true })
    .click();
}
async function resume(page) {
  await page.getByRole("button", { name: /^Continue .+ pack$/ }).click();
}
async function buy(page, id) {
  const badge = page.getByTestId(`shelf-price-${id}`);
  const before = await balance(page);
  await page.getByTestId(`shelf-pack-${id}`).locator("img").click();
  assert.match(await badge.innerText(), /Confirm\?/);
  assert.equal(await balance(page), before);
  await badge.click();
  await page.getByTestId("opener-modal").waitFor();
}
async function revealRow(page) {
  for (let index = 0; index < 11; index++) {
    const card = page.getByTestId("opener-card").nth(index);
    if ((await card.getAttribute("data-revealed")) === "false")
      await card.click();
  }
  await stage(page, "complete");
}
async function viewCards(page) {
  await page
    .getByRole("button", { name: "View/Sell cards", exact: true })
    .click();
  await page.getByTestId("inventory-modal").waitFor();
}
async function assertProfile(page) {
  assert.equal(
    await page.evaluate(() => localStorage.getItem("ppc-profile")),
    profile,
  );
}
try {
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await desktopContext.newPage();
  await prepare(page);
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Card Opener", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/card-opener");
  assert.equal(await balance(page), 1000000);
  assert.equal(
    await page
      .locator(
        ".co-shop-sidebar, .co-featured, .co-shop-session, .co-about, .co-shop-welcome, .co-gallery",
      )
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "View your last pack", exact: true })
      .count(),
    0,
  );
  assert.equal(await page.locator(".co-pack-cabinet").count(), 1);
  assert.equal(await page.locator(".co-shop-product").count(), 6);
  await page
    .locator(".co-pack-frame img")
    .evaluateAll((images) =>
      Promise.all(images.map((image) => image.decode())),
    );
  await page
    .locator(".co-pledge-badge img")
    .evaluate((image) => image.decode());
  const badge = await page.locator(".co-pledge-badge").boundingBox();
  assert.ok(badge.x < 60 && badge.y < 50 && badge.width >= 200);
  assert.match(
    await page.locator(".co-pledge-badge").getAttribute("href"),
    /domain=playpokemoncards\.pages\.dev#art/,
  );
  assert.equal(
    await page.getByRole("button", { name: "Stack", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page.locator(".co-cabinet-heading .co-cabinet-preferences").count(),
    1,
  );
  const preferences = await page.locator(".co-cabinet-preferences").boundingBox();
  const heading = await page.locator(".co-cabinet-title").boundingBox();
  assert.ok(
    preferences.x > heading.x + heading.width &&
      preferences.y < heading.y + heading.height,
  );
  await shot(page, "desktop-cabinet");
  await page.getByRole("button", { name: "Row", exact: true }).click();
  await viewCards(page);
  assert.equal(await page.getByTestId("opened-card").count(), 0);
  await close(page);

  const baseBadge = page.getByTestId("shelf-price-base1");
  const basePack = page.getByTestId("shelf-pack-base1").locator("img");
  await basePack.click();
  assert.match(await baseBadge.innerText(), /Confirm\?/);
  assert.equal(await balance(page), 1000000);
  await page.keyboard.press("Escape");
  assert.doesNotMatch(await baseBadge.innerText(), /Confirm/);
  await basePack.click();
  await basePack.click();
  const firstBalance = 1000000 - price("base1");
  assert.equal(await balance(page), firstBalance);
  await shot(page, "purchase-animation");
  await page.reload({ waitUntil: "networkidle" });
  await stage(page, "sealed");
  assert.equal((await saved(page)).mode, "row");
  assert.equal(await balance(page), firstBalance);
  assert.equal(
    await page
      .getByTestId("opener-modal")
      .locator(".co-toolbar, select")
      .count(),
    0,
  );
  assert.equal(
    await page.locator(".co-shop-shell").evaluate((element) => element.inert),
    true,
  );
  await shot(page, "desktop-sealed");
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() =>
        Boolean(document.activeElement.closest('[data-testid="opener-modal"]')),
      ),
    );
  }
  await page.keyboard.press("Escape");
  await resume(page);
  const tear = page.getByTestId("opener-tear");
  const box = await tear.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 3, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 4, y, { steps: 8 });
  await page.mouse.up();
  assert.equal(await tear.getAttribute("aria-valuenow"), "0");
  await page.mouse.move(box.x + 3, y);
  await page.mouse.down();
  assert.equal(
    await page.locator(".co-tear-guide, .co-pack-drag-label").count(),
    0,
  );
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 10 });
  assert.ok(Number(await tear.getAttribute("aria-valuenow")) > 30);
  const seam = await page.locator(".co-tear-line").evaluate((element) => ({
    clip: getComputedStyle(element).clipPath,
    transform: getComputedStyle(element).transform,
    points: element.querySelector("polyline").points.numberOfItems,
  }));
  assert.match(seam.clip, /inset/);
  assert.equal(seam.transform, "none");
  assert.ok(seam.points > 30);
  await shot(page, "tear-in-progress");
  await page.mouse.up();
  await stage(page, "sealed");
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, y, { steps: 12 });
  await page.mouse.up();
  await stage(page, "dealing");
  assert.equal(await page.getByTestId("emerging-card").count(), 11);
  await page.waitForTimeout(650);
  await shot(page, "cards-emerging");
  await stage(page, "revealing");
  assert.equal(await balance(page), firstBalance);
  await page.getByTestId("opener-card").first().click();
  assert.equal((await saved(page)).history.length, 1);
  await page.getByTestId("opener-card").first().click();
  await page.getByTestId("card-preview").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByTestId("opener-modal").count(), 1);
  await close(page);
  await page.getByRole("button", { name: "Stack", exact: true }).click();
  await resume(page);
  assert.equal(await page.getByTestId("opener-card").count(), 1);
  await page.getByTestId("opener-card").click();
  assert.equal((await saved(page)).history.length, 2);
  await shot(page, "stack-revealed");
  await close(page);
  await page
    .getByRole("switch", { name: "Show card values", exact: true })
    .click();
  assert.equal(await page.getByTestId("opener-card-value").count(), 0);
  assert.equal(
    await page.getByTestId("shelf-price-jungle").locator("span").innerText(),
    formatValue(price("jungle") / 100),
  );
  await page.getByRole("button", { name: "Row", exact: true }).click();
  await resume(page);
  await revealRow(page);
  assert.equal(
    await page.getByTestId("opener-card").last().getAttribute("data-big-hit"),
    "true",
  );
  assert.equal(
    await page
      .getByTestId("opener-card")
      .last()
      .locator(".co-hit-star")
      .count(),
    12,
  );
  await shot(page, "big-hit-row");
  await page
    .getByTestId("opener-modal")
    .getByRole("button", { name: "View/Sell cards", exact: true })
    .click();
  await page.getByTestId("inventory-modal").waitFor();
  assert.equal(await page.getByTestId("opened-card").count(), 11);
  assert.equal(await page.getByTestId("opener-modal").count(), 0);
  await shot(page, "view-sell");

  const firstCard = page.getByTestId("opened-card").first();
  const entryKey = await firstCard.getAttribute("data-entry-key");
  const entry = (await saved(page)).history.find(
    (item) => item.key === entryKey,
  );
  const sale = saleValueCents(entry.cardId);
  assert.equal(await page.getByTestId("inventory-card-price").count(), 11);
  await page.getByRole("switch", { name: "Show inventory prices" }).click();
  assert.equal(await page.getByTestId("inventory-card-price").count(), 0);
  await page.getByRole("switch", { name: "Show inventory prices" }).click();
  await firstCard.getByTestId("inventory-card").click();
  assert.equal(await balance(page), firstBalance, "selecting does not sell");
  await firstCard.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await firstCard.getAttribute("data-confirming"), "false");
  await firstCard.getByTestId("sell-card").click();
  assert.equal(await balance(page), firstBalance, "sales need confirmation");
  await firstCard.getByTestId("inventory-card").click();
  assert.equal(await balance(page), firstBalance + sale);
  assert.equal(await firstCard.getByTestId("sell-card").isDisabled(), true);
  assert.equal(
    (await saved(page)).history.find((item) => item.key === entryKey)
      .soldForCents,
    sale,
  );
  await page.reload({ waitUntil: "networkidle" });
  await viewCards(page);
  const soldCard = page.locator(`[data-entry-key="${entryKey}"]`);
  assert.equal(await soldCard.getAttribute("data-sold"), "true");
  assert.equal(await soldCard.getByTestId("sell-card").isDisabled(), true);
  assert.equal(await balance(page), firstBalance + sale);
  await soldCard.getByRole("button", { name: /^Inspect opened/ }).click();
  await page.getByTestId("card-preview").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByTestId("inventory-modal").count(), 1);
  await page
    .getByRole("combobox", { name: "Filter cards by sale status" })
    .selectOption("sold");
  assert.equal(await page.getByTestId("opened-card").count(), 1);
  await page
    .getByRole("combobox", { name: "Filter cards by sale status" })
    .selectOption("available");
  assert.equal(await page.getByTestId("opened-card").count(), 10);
  const expectedCredit = (await saved(page)).history
    .filter((item) => item.soldForCents === undefined)
    .reduce((sum, item) => sum + (saleValueCents(item.cardId) ?? 0), 0);
  await page.getByTestId("sell-all").click();
  assert.equal(
    await balance(page),
    firstBalance + sale,
    "bulk sale needs confirmation",
  );
  await page.getByTestId("sell-all").click();
  const soldBalance = firstBalance + sale + expectedCredit;
  assert.equal(await balance(page), soldBalance);
  assert.equal(await page.getByTestId("opened-card").count(), 0);
  assert.equal(await page.getByTestId("sell-all").isDisabled(), true);
  await page
    .getByRole("combobox", { name: "Filter cards by sale status" })
    .selectOption("all");
  assert.equal(await page.getByTestId("opened-card").count(), 11);
  assert.equal(await page.locator('[data-sold="true"]').count(), 11);
  await shot(page, "sold-cards");
  await close(page);
  assert.equal(await page.locator(".co-gallery").count(), 0);
  await page
    .getByRole("switch", { name: "Show card values", exact: true })
    .click();
  await buy(page, "jungle");
  assert.equal(await balance(page), soldBalance - price("jungle"));
  await page.getByTestId("opener-tear").focus();
  await page.keyboard.press("Enter");
  await stage(page, "revealing");
  await page.getByTestId("opener-card").first().click();
  await close(page);
  await page
    .getByRole("button", { name: "Return to main menu", exact: true })
    .click();
  await page.getByRole("button", { name: "Card Opener", exact: true }).click();
  await stage(page, "revealing");
  await close(page);
  await viewCards(page);
  await page
    .getByRole("combobox", { name: "Filter opened cards by set" })
    .selectOption("jungle");
  assert.equal(await page.getByTestId("opened-card").count(), 1);
  await page
    .getByRole("combobox", { name: "Filter opened cards by set" })
    .selectOption("all");
  await page
    .getByRole("textbox", { name: "Search opened cards" })
    .fill("a card that does not exist");
  assert.equal(await page.getByTestId("opened-card").count(), 0);
  await page
    .getByRole("button", { name: "Show all opened cards", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Sort opened cards" })
    .selectOption("value");
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep my cards", exact: true })
    .click();
  assert.equal((await saved(page)).history.length, 12);
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Clear opened cards" })
    .getByRole("button", { name: "Clear session", exact: true })
    .click();
  assert.equal((await saved(page)).history.length, 0);
  assert.equal(await balance(page), soldBalance - price("jungle"));
  await close(page);
  await assertProfile(page);

  // Existing wallets receive only the difference in starting funds, once.
  const migration = await browser.newPage();
  await prepare(migration);
  await migration.addInitScript((key) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, balanceCents: 8354 }),
      );
  }, OPENER_WALLET_KEY);
  await migration.goto(new URL("/card-opener", base).href);
  assert.equal(await balance(migration), 908354);
  await migration.reload();
  assert.equal(await balance(migration), 908354);
  await migration.close();

  // A low balance can still buy; another purchase is allowed while in debt.
  const debt = await browser.newPage({ reducedMotion: "reduce" });
  await prepare(debt);
  await debt.addInitScript((key) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 2,
          startingBalanceCents: 1000000,
          balanceCents: 100,
        }),
      );
  }, OPENER_WALLET_KEY);
  await debt.goto(new URL("/card-opener", base).href);
  await debt.getByRole("button", { name: "Row", exact: true }).click();
  await buy(debt, "base1");
  assert.equal(await balance(debt), 100 - price("base1"));
  await debt.getByTestId("opener-tear").focus();
  await debt.keyboard.press("Enter");
  await stage(debt, "revealing");
  await revealRow(debt);
  await close(debt);
  await buy(debt, "jungle");
  assert.equal(await balance(debt), 100 - price("base1") - price("jungle"));
  await debt.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const mobile = await mobileContext.newPage();
  await prepare(mobile);
  await mobile.goto(new URL("/card-opener", base).href, {
    waitUntil: "networkidle",
  });
  assert.equal(await balance(mobile), OPENER_STARTING_BALANCE_CENTS);
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await shot(mobile, "mobile-cabinet");
  assert.equal(
    await mobile.getByRole("button", { name: "Stack", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  await buy(mobile, "base1");
  await shot(mobile, "mobile-sealed");
  const target = mobile.getByTestId("opener-tear");
  await target.scrollIntoViewIfNeeded();
  const touchBox = await target.boundingBox();
  const cdp = await mobileContext.newCDPSession(mobile);
  const touchY = touchBox.y + touchBox.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchBox.x + 3, y: touchY }],
  });
  assert.equal(
    await mobile.locator(".co-tear-guide, .co-pack-drag-label").count(),
    0,
  );
  for (let step = 1; step <= 10; step++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: touchBox.x + ((touchBox.width - 1) * step) / 10, y: touchY },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await stage(mobile, "revealing");
  await mobile.getByTestId("opener-card").tap();
  await close(mobile);
  await viewCards(mobile);
  const mobileEntry = (await saved(mobile)).history[0];
  await shot(mobile, "mobile-view-sell");
  await mobile.getByTestId("inventory-card").tap();
  assert.equal(await balance(mobile), firstBalance);
  await mobile.getByTestId("sell-card").tap();
  assert.equal(
    await balance(mobile),
    firstBalance + saleValueCents(mobileEntry.cardId),
  );
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await assertProfile(mobile);
  await mobileContext.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "Cabinet passed: whole pack confirmation, header preferences, default Stack and saved Row, jagged foil tear, uncluttered shop, original pack images, badge, $10,000 grant and migration, purchases below zero, mouse and touch tearing, both reveal modes, View/Sell inventory, individual and confirmed bulk sales, sale persistence, filtering, keyboard controls, and Story Mode isolation.",
  );
} finally {
  await browser.close();
}

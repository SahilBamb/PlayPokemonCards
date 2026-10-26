import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { OPENER_SETS, formatValue } from "../src/lib/cardOpener.js";

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
  await page
    .getByRole("button", { name: "Your pack is waiting", exact: true })
    .click();
}
async function buy(page, id) {
  const badge = page.getByTestId(`shelf-price-${id}`);
  const before = await balance(page);
  await badge.click();
  assert.match(await badge.innerText(), /Confirm\?/);
  assert.equal(
    await balance(page),
    before,
    "selecting a price does not spend money",
  );
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
  await page.getByTestId("card-shop").waitFor();
  assert.equal(await balance(page), 100000);
  assert.equal(await page.getByTestId("opener-modal").count(), 0);
  await page.locator(".co-shop-background").evaluate((image) => image.decode());
  await page.locator(".co-shopkeeper").evaluate((image) => image.decode());
  await page
    .locator(".co-pack-frame img")
    .evaluateAll((images) =>
      Promise.all(images.map((image) => image.decode())),
    );
  assert.equal(await page.locator(".co-shop-product").count(), 6);
  assert.equal(
    await page.locator(".co-shop-product h3, .co-product-description").count(),
    0,
  );
  const frame = await page.locator(".co-pack-frame").first().boundingBox();
  const badgeBox = await page.getByTestId("shelf-price-base1").boundingBox();
  assert.ok(
    badgeBox.x < frame.x &&
      badgeBox.y + badgeBox.height > frame.y + frame.height,
    "price badge overlaps the lower left image edge",
  );
  assert.equal(
    await page
      .locator(".co-pack-frame")
      .first()
      .evaluate((element) => getComputedStyle(element).borderTopColor),
    "rgb(255, 255, 255)",
  );
  await shot(page, "desktop-shop");
  await page
    .getByRole("button", { name: "Next featured pack", exact: true })
    .click();
  assert.match(
    await page.locator(".co-featured-copy h3").innerText(),
    /Jungle/,
  );

  const baseBadge = page.getByTestId("shelf-price-base1");
  await baseBadge.click();
  assert.match(await baseBadge.innerText(), /Confirm\?/);
  assert.equal(await balance(page), 100000);
  assert.equal(await page.getByTestId("opener-modal").count(), 0);
  await shot(page, "confirm-badge");
  await page.keyboard.press("Escape");
  assert.doesNotMatch(await baseBadge.innerText(), /Confirm/);
  await baseBadge.click();
  await baseBadge.click();
  const firstBalance = 100000 - price("base1");
  assert.equal(await balance(page), firstBalance);
  assert.equal(await page.locator(".co-shop-product.taking").count(), 1);
  await shot(page, "purchase-animation");
  // A refresh during delivery must recover the paid sealed pack without a second charge.
  await page.reload({ waitUntil: "networkidle" });
  await stage(page, "sealed");
  assert.equal(await balance(page), firstBalance);
  assert.equal(
    await page
      .getByTestId("opener-modal")
      .locator(".co-toolbar, select")
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByTestId("opener-modal")
      .getByRole("button", { name: "Row", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.getByTestId("opener-modal").getByRole("switch").count(),
    0,
  );
  assert.equal(
    await page
      .getByTestId("opener-modal")
      .evaluate((element) => getComputedStyle(element).borderTopWidth),
    "0px",
  );
  assert.equal(
    await page.locator(".co-shop-shell").evaluate((element) => element.inert),
    true,
  );
  assert.equal(
    await page.evaluate(() => document.body.style.overflow),
    "hidden",
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
  assert.equal(await page.getByTestId("opener-modal").count(), 0);
  assert.equal(
    await page.locator(".co-shop-shell").evaluate((element) => element.inert),
    false,
  );
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
    "guide and prompt disappear as soon as a valid tear starts",
  );
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 10 });
  const progress = Number(await tear.getAttribute("aria-valuenow"));
  assert.ok(progress > 30 && progress < 75);
  await shot(page, "tear-in-progress");
  await page.mouse.up();
  await stage(page, "sealed");
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, y, { steps: 12 });
  await page.mouse.up();
  await stage(page, "tearing");
  await stage(page, "dealing");
  assert.equal(await page.getByTestId("emerging-card").count(), 11);
  assert.equal(await page.locator(".co-empty-wrapper img").count(), 1);
  assert.equal(await page.getByTestId("opener-card").count(), 0);
  await page.waitForTimeout(650);
  await shot(page, "cards-emerging");
  await stage(page, "revealing");
  assert.equal(
    await balance(page),
    firstBalance,
    "tearing does not charge again",
  );
  assert.equal(await page.getByTestId("opener-card").count(), 11);
  assert.equal(await page.getByTestId("opened-card").count(), 0);
  await page.getByTestId("opener-card").first().click();
  assert.equal(await page.getByTestId("opened-card").count(), 1);
  await page.getByTestId("opener-card").first().click();
  await page.getByTestId("card-preview").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByTestId("card-preview").count(), 0);
  assert.equal(await page.getByTestId("opener-modal").count(), 1);

  await close(page);
  await page.getByRole("button", { name: "Stack", exact: true }).click();
  await resume(page);
  assert.equal(await page.getByTestId("opener-card").count(), 1);
  assert.equal(
    await page.getByTestId("opener-card").getAttribute("data-revealed"),
    "false",
  );
  await page.getByTestId("opener-card").click();
  assert.equal(await page.getByTestId("opened-card").count(), 2);
  await shot(page, "stack-revealed");
  await page.getByRole("button", { name: "Inspect card", exact: true }).click();
  await page.getByTestId("card-preview").waitFor();
  await page
    .getByRole("button", { name: "Close card preview", exact: true })
    .click();
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  assert.equal(
    await page.getByTestId("opener-card").getAttribute("data-revealed"),
    "false",
  );
  await close(page);
  await page
    .getByRole("switch", { name: "Show card values", exact: true })
    .click();
  assert.equal(await page.getByTestId("opener-card-value").count(), 0);
  assert.equal(await balance(page), firstBalance);
  assert.equal(
    await baseBadge.locator("span").innerText(),
    formatValue(price("base1") / 100),
  );
  await page
    .getByRole("switch", { name: "Show card values", exact: true })
    .click();
  await page.getByRole("button", { name: "Row", exact: true }).click();
  await resume(page);
  await revealRow(page);
  assert.equal(await page.getByTestId("opened-card").count(), 11);
  await shot(page, "row-complete");
  await page
    .getByRole("button", { name: "Choose another pack", exact: true })
    .click();

  await page.getByRole("button", { name: "Stack", exact: true }).click();
  await buy(page, "jungle");
  const debt = firstBalance - price("jungle");
  assert.ok(debt < 0);
  assert.equal(await balance(page), debt);
  await page.getByTestId("opener-tear").focus();
  await page.keyboard.press("Enter");
  await stage(page, "dealing");
  assert.equal(await page.locator(".co-pack-emergence.stack").count(), 1);
  assert.equal(
    await page.getByTestId("emerging-card").count(),
    11,
    "stack mode also animates every card out of the pack",
  );
  await stage(page, "revealing");
  await page.getByTestId("opener-card").click();
  assert.equal(await page.getByTestId("opened-card").count(), 12);
  await close(page);
  await page.getByRole("button", { name: "Row", exact: true }).click();
  await resume(page);
  await revealRow(page);
  await close(page);
  assert.equal(await page.getByTestId("opened-card").count(), 22);
  await buy(page, "fossil");
  const furtherDebt = debt - price("fossil");
  assert.equal(
    await balance(page),
    furtherDebt,
    "players who are already negative can keep buying",
  );
  await close(page);
  await assertProfile(page);

  await page
    .getByRole("button", { name: "Return to main menu", exact: true })
    .click();
  await page.getByRole("button", { name: "Card Opener", exact: true }).click();
  await stage(page, "sealed");
  assert.equal(await balance(page), furtherDebt);
  await close(page);
  await page
    .getByRole("combobox", { name: "Filter opened cards by set" })
    .selectOption("jungle");
  assert.equal(await page.getByTestId("opened-card").count(), 11);
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
  await page.locator(".co-gallery").scrollIntoViewIfNeeded();
  await shot(page, "gallery");
  await page
    .getByRole("button", { name: "Clear session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep my cards", exact: true })
    .click();
  assert.equal(await page.getByTestId("opened-card").count(), 22);
  await page
    .getByRole("button", { name: "Clear session", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Clear opened cards" })
    .getByRole("button", { name: "Clear session", exact: true })
    .click();
  assert.equal(await page.getByTestId("opened-card").count(), 0);
  assert.equal(
    await balance(page),
    furtherDebt,
    "clearing cards never resets money",
  );
  await resume(page);
  await stage(page, "sealed");
  assert.match(
    await page.locator(".co-pack-body img").getAttribute("alt"),
    /Fossil/,
  );
  await close(page);
  const anotherTab = await page.context().newPage();
  await prepare(anotherTab);
  await anotherTab.goto(new URL("/card-opener", base).href);
  assert.equal(
    await balance(anotherTab),
    furtherDebt,
    "new tabs do not grant another starting balance",
  );
  await anotherTab.close();
  await assertProfile(page);

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
  assert.equal(await balance(mobile), 100000);
  await shot(mobile, "mobile-shop");
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await mobile.getByRole("button", { name: "Stack", exact: true }).tap();
  await buy(mobile, "base1");
  await shot(mobile, "mobile-sealed");
  const touchTarget = mobile.getByTestId("opener-tear");
  await touchTarget.scrollIntoViewIfNeeded();
  const touchBox = await touchTarget.boundingBox();
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
  assert.equal(await mobile.getByTestId("opener-card").count(), 1);
  await mobile.getByTestId("opener-card").tap();
  assert.equal(await mobile.getByTestId("opened-card").count(), 1);
  assert.equal(await balance(mobile), firstBalance);
  await shot(mobile, "mobile-stack");
  await mobile.getByRole("button", { name: "Inspect card", exact: true }).tap();
  await mobile.getByTestId("card-preview").waitFor();
  await mobile
    .getByRole("button", { name: "Close card preview", exact: true })
    .tap();
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await assertProfile(mobile);
  await mobileContext.close();

  const offline = await browser.newPage({ reducedMotion: "reduce" });
  await prepare(offline);
  await offline.route("https://images.pokemontcg.io/**", (route) =>
    route.abort(),
  );
  await offline.goto(new URL("/card-opener", base).href);
  await buy(offline, "base1");
  await offline.getByTestId("opener-tear").focus();
  await offline.keyboard.press("Enter");
  await stage(offline, "revealing");
  await offline.getByTestId("opener-card").first().click();
  await offline
    .getByTestId("opener-card")
    .first()
    .getByText("Card art is unavailable right now.")
    .waitFor();
  await offline.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "Card shop passed: image tiles, price confirmation, purchase delivery, sourced prices, persistent and negative balances, single charges, minimal popup, disappearing guides, eleven card emergence, row and stack reveals, preferences, gallery, keyboard and touch, and Story Mode isolation.",
  );
} finally {
  await browser.close();
}

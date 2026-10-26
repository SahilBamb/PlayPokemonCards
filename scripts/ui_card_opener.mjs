import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

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

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await prepare(page);
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Card Opener", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/card-opener");
  await page.getByTestId("card-shop").waitFor();
  assert.equal(await page.getByTestId("opener-modal").count(), 0);
  await page.locator(".co-shop-background").evaluate((image) => image.decode());
  await page.locator(".co-shopkeeper").evaluate((image) => image.decode());
  await shot(page, "desktop-shop");
  await page
    .getByRole("button", { name: "Next featured pack", exact: true })
    .click();
  assert.match(
    await page.locator(".co-featured-copy h3").innerText(),
    /Jungle/,
  );
  await page
    .getByRole("button", { name: "Choose Base Set pack", exact: true })
    .click();
  assert.equal(
    await page.locator(".co-shop-shell").evaluate((element) => element.inert),
    true,
  );

  assert.equal(
    await page.getByRole("combobox", { name: "Booster set" }).inputValue(),
    "base1",
  );
  assert.equal(
    await page
      .getByRole("combobox", { name: "Booster set" })
      .locator("option")
      .count(),
    6,
  );
  await stage(page, "sealed");
  for (const set of ["base1", "jungle", "fossil", "rocket", "gym1", "gym2"]) {
    await page.getByRole("combobox", { name: "Booster set" }).selectOption(set);
    await page.locator(".co-pack-body img").evaluate((image) => image.decode());
  }
  await page
    .getByRole("combobox", { name: "Booster set" })
    .selectOption("base1");
  await shot(page, "desktop-sealed");
  assert.equal(
    await page.evaluate(() => document.body.style.overflow),
    "hidden",
  );
  for (let index = 0; index < 14; index += 1) {
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
  await page
    .getByRole("button", { name: "Choose Base Set pack", exact: true })
    .click();

  const tear = page.getByTestId("opener-tear");
  const box = await tear.boundingBox();
  const y = box.y + box.height / 2;
  // The opening must start at the left edge. A reverse gesture does nothing.
  await page.mouse.move(box.x + box.width - 3, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 4, y, { steps: 8 });
  await page.mouse.up();
  assert.equal(await tear.getAttribute("aria-valuenow"), "0");
  await page.mouse.move(box.x + 3, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 10 });
  const progress = Number(await tear.getAttribute("aria-valuenow"));
  assert.ok(progress > 30 && progress < 75, "the tear follows the drag");
  assert.equal(await page.getByTestId("opened-card").count(), 0);
  await shot(page, "tear-in-progress");
  await page.mouse.up();
  await stage(page, "sealed");
  // Releasing early keeps the torn edge; resuming completes exactly one pack.
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, y, { steps: 12 });
  await page.mouse.up();
  await stage(page, "tearing");
  await stage(page, "revealing");
  assert.equal(await page.getByTestId("opener-card").count(), 11);
  assert.equal(
    await page
      .locator('[data-testid="opener-card"][data-revealed="true"]')
      .count(),
    0,
  );
  assert.equal(await page.getByTestId("opened-card").count(), 0);
  await shot(page, "row-hidden");
  await page.getByTestId("opener-card").first().click();
  assert.equal(await page.getByTestId("opened-card").count(), 1);
  assert.equal(await page.getByTestId("opener-card-value").count(), 2);
  await page.getByTestId("opener-card").first().click();
  await page.getByTestId("card-preview").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByTestId("card-preview").count(), 0);
  assert.equal(await page.getByTestId("opener-modal").count(), 1);

  await page.getByRole("button", { name: "Stack", exact: true }).click();
  assert.equal(await page.getByTestId("opener-card").count(), 1);
  assert.equal(
    await page.getByTestId("opener-card").getAttribute("data-revealed"),
    "false",
  );
  await page.getByTestId("opener-card").click();
  assert.equal(await page.getByTestId("opened-card").count(), 2);
  await page.waitForTimeout(700);
  await shot(page, "stack-revealed");
  await page
    .getByRole("button", { name: "Back to card shop", exact: true })
    .click();
  assert.equal(await page.getByTestId("opener-modal").count(), 0);
  await page
    .getByRole("button", { name: "Choose Fossil pack", exact: true })
    .click();
  assert.match(await page.locator(".co-stage-caption").innerText(), /BASE SET/);
  assert.equal(
    await page.getByTestId("opener-card").getAttribute("data-revealed"),
    "true",
  );

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
  assert.equal(await page.getByTestId("opened-card").count(), 2);
  await page
    .getByRole("switch", { name: "Show card values", exact: true })
    .click();
  assert.equal(await page.getByTestId("opener-card-value").count(), 0);
  await page
    .getByRole("switch", { name: "Show card values", exact: true })
    .click();

  await page.getByRole("button", { name: "Row", exact: true }).click();
  for (let index = 0; index < 11; index += 1) {
    const card = page.getByTestId("opener-card").nth(index);
    if ((await card.getAttribute("data-revealed")) === "false")
      await card.click();
  }
  await stage(page, "complete");
  assert.equal(await page.getByTestId("opened-card").count(), 11);
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "row-complete");

  await page
    .getByRole("button", { name: "Back to card shop", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("switch", { name: "Battle animations", exact: true })
    .click();
  await page
    .getByTestId("settings-modal")
    .getByRole("button", { name: "×", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose Jungle pack", exact: true })
    .click();
  await stage(page, "sealed");
  await page.getByRole("button", { name: "Stack", exact: true }).click();
  // Keyboard controls provide the same opening without a pointer gesture.
  await page.getByTestId("opener-tear").focus();
  await page.keyboard.press("Enter");
  await stage(page, "revealing");
  await page.getByTestId("opener-card").click();
  assert.equal(await page.getByTestId("opened-card").count(), 12);
  assert.match(await page.locator(".co-stage-caption").innerText(), /JUNGLE/);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("ppc-profile")),
    profile,
  );

  await page
    .getByRole("button", { name: "Back to card shop", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Return to main menu", exact: true })
    .click();
  await page.getByRole("button", { name: "Card Opener", exact: true }).click();
  assert.equal(await page.getByTestId("opened-card").count(), 12);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByTestId("opened-card").count(), 12);
  assert.equal(
    await page.getByTestId("opener-card").getAttribute("data-revealed"),
    "true",
  );
  await page
    .getByRole("button", { name: "Back to card shop", exact: true })
    .click();
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
  assert.equal(await page.getByTestId("opened-card").count(), 12);
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
  assert.equal(await page.getByTestId("opened-card").count(), 12);
  await page
    .getByRole("button", { name: "Clear session", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Clear opened cards" })
    .getByRole("button", { name: "Clear session", exact: true })
    .click();
  assert.equal(await page.getByTestId("opened-card").count(), 0);
  assert.equal(await page.getByTestId("opener-modal").count(), 0);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("ppc-profile")),
    profile,
  );

  // Independent mobile tab with reduced motion and touch input.
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
  await shot(mobile, "mobile-shop");
  await mobile
    .getByRole("button", { name: "Choose Base Set pack", exact: true })
    .tap();
  await shot(mobile, "mobile-sealed");
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile page must not overflow sideways",
  );
  const touchTarget = mobile.getByTestId("opener-tear");
  await touchTarget.scrollIntoViewIfNeeded();
  const touchBox = await touchTarget.boundingBox();
  const cdp = await mobileContext.newCDPSession(mobile);
  const touchY = touchBox.y + touchBox.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchBox.x + 3, y: touchY }],
  });
  for (let step = 1; step <= 10; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: touchBox.x + ((touchBox.width - 1) * step) / 10, y: touchY },
      ],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await stage(mobile, "revealing");
  await mobile.getByTestId("opener-card").first().tap();
  assert.equal(await mobile.getByTestId("opened-card").count(), 1);
  await mobile.getByRole("button", { name: "Stack", exact: true }).tap();
  await mobile.getByTestId("opener-card").tap();
  await mobile.getByTestId("opener-stage").scrollIntoViewIfNeeded();
  assert.equal(
    await mobile
      .locator(".co-stack-value")
      .evaluate((element) => getComputedStyle(element).opacity),
    "1",
    "reduced motion must show card values without an animation delay",
  );
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
  assert.equal(
    await mobile.evaluate(() => localStorage.getItem("ppc-profile")),
    profile,
  );
  await mobileContext.close();

  // Missing external art must retain the card identity in both reveal modes.
  const offline = await browser.newPage({ reducedMotion: "reduce" });
  await prepare(offline);
  await offline.route("https://images.pokemontcg.io/**", (route) =>
    route.abort(),
  );
  await offline.goto(new URL("/card-opener", base).href);
  await offline
    .getByRole("button", { name: "Choose Base Set pack", exact: true })
    .click();
  await offline.getByRole("button", { name: "Open pack", exact: true }).click();
  await stage(offline, "revealing");
  await offline.getByTestId("opener-card").first().click();
  await offline
    .getByTestId("opener-card")
    .first()
    .getByText("Card art is unavailable right now.")
    .waitFor();
  await offline.getByRole("button", { name: "Stack", exact: true }).click();
  await offline.getByTestId("opener-card").click();
  await offline
    .getByTestId("opener-card")
    .getByText("Card art is unavailable right now.")
    .waitFor();
  assert.equal(await offline.getByTestId("opened-card").count(), 2);
  await offline.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "Card shop passed: storefront, popup isolation, mouse and touch tearing, partial drag recovery, keyboard opening, row and stack reveals, values, set switching, gallery, inspection, session recovery, and collection isolation.",
  );
} finally {
  await browser.close();
}

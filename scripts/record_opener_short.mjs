import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { OPENER_STORAGE_KEY } from "../src/lib/cardOpener.js";

const folder = resolve(process.argv[2] || ".cache/pack-short");
const manifest = JSON.parse(await readFile(join(folder, "pack-manifest.json"), "utf8"));
const plan = JSON.parse(await readFile(join(folder, "edit-plan.json"), "utf8"));
const base = process.env.OPENER_URL || "http://127.0.0.1:5201";
await mkdir(join(folder, "recordings", "raw"), { recursive: true });
await mkdir(join(folder, "frames"), { recursive: true });
const images = new Map();
await mkdir(join(folder, "sources", "cards"), { recursive: true });
for (const card of manifest.cards) {
  const cached = join(folder, "sources", "cards", `${card.id}.png`);
  let buffer;
  try {
    buffer = await readFile(cached);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    execFileSync("curl", ["--fail", "--silent", "--show-error", "--retry", "2", card.largeImage, "-o", cached]);
    buffer = await readFile(cached);
  }
  images.set(card.image, buffer);
  images.set(card.largeImage, buffer);
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 720, height: 1280 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
  recordVideo: { dir: join(folder, "recordings", "raw"), size: { width: 720, height: 1280 } },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route(/all-sites-analytics\.pages\.dev|cloudflareinsights\.com/, (route) =>
  route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
);
await page.route("https://images.pokemontcg.io/**", (route) => {
  const body = images.get(route.request().url());
  return body ? route.fulfill({ status: 200, contentType: "image/png", body }) : route.continue();
});
await page.addInitScript(() => {
  localStorage.setItem("ppc-settings", JSON.stringify({
    animations: true, sound: false, volume: 0, theme: "dark",
  }));
});
const recording = { seed: manifest.seed, events: [], viewport: { width: 720, height: 1280 } };
try {
  const url = new URL("/card-opener", base);
  url.searchParams.set("seed", manifest.seed);
  await page.goto(url.href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".co-pack-frame img").evaluateAll((images) =>
    Promise.all(images.map((image) => image.decode())),
  );
  await page.evaluate(() => {
    const cursor = document.createElement("div");
    cursor.id = "recording-cursor";
    cursor.style.cssText = "position:fixed;width:17px;height:17px;border:2px solid white;border-radius:50%;background:#f472b655;box-shadow:0 0 8px #f472b680;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);left:-30px;top:-30px;transition:width .08s,height .08s";
    document.body.append(cursor);
    const marker = document.createElement("div");
    marker.id = "recording-sync";
    marker.style.cssText = "position:fixed;left:704px;top:1104px;width:8px;height:8px;pointer-events:none;z-index:99999;background:#ff00ff";
    document.body.append(marker);
    document.addEventListener("pointermove", (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
    document.addEventListener("pointerdown", () => { cursor.style.width = "23px"; cursor.style.height = "23px"; });
    document.addEventListener("pointerup", () => { cursor.style.width = "17px"; cursor.style.height = "17px"; });
  });
  await page.evaluate(() => {
    document.getElementById("recording-sync").style.background = "#00ff00";
  });
  const start = performance.now();
  const elapsed = () => (performance.now() - start) / 1000;
  const until = async (seconds) => {
    const ms = seconds * 1000 - (performance.now() - start);
    if (ms > 0) await page.waitForTimeout(ms);
  };
  const mark = (name, extra = {}) => recording.events.push({ name, rawAt: elapsed(), ...extra });
  mark("start");
  await until(0.4);
  await page.getByTestId(`shelf-pack-${manifest.setId}`).locator("img").click();
  mark("selected");
  await until(0.85);
  await page.getByTestId(`shelf-pack-${manifest.setId}`).locator("img").click();
  mark("purchased");
  await page.getByTestId("opener-tear").waitFor();
  mark("popup", { bounds: await page.getByTestId("opener-pack").boundingBox() });
  await until(plan.openingRetimeStart);
  const tear = await page.getByTestId("opener-tear").boundingBox();
  const y = tear.y + tear.height / 2;
  await page.mouse.move(tear.x + 3, y);
  await page.mouse.down();
  mark("tearStart");
  for (let step = 1; step <= 12; step++) {
    await until(plan.openingRetimeStart + (step / 12) * 0.6);
    await page.mouse.move(tear.x + (tear.width - 2) * step / 12, y);
  }
  await page.mouse.up();
  await page.mouse.move(35, 1050);
  mark("tearEnd");
  await page.locator('[data-stage="revealing"]').waitFor();
  await page.waitForTimeout(250);
  const actual = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), OPENER_STORAGE_KEY);
  assert.deepEqual(actual.pack.ids, manifest.cards.map((card) => card.id));
  const firstRaw = elapsed();
  const offset = firstRaw - plan.firstReveal;
  recording.postOpeningOffset = offset;
  recording.firstRevealRaw = firstRaw;
  recording.stackBounds = await page.locator(".co-stack-scene").boundingBox();
  for (let index = 0; index < plan.reveals.length; index++) {
    const card = plan.reveals[index];
    if (index > 0) {
      const backAt = index === 10 ? plan.rareBackAt : card.at - 0.25;
      await until(backAt + offset);
      await page.getByTestId("opener-card").click();
      await page.mouse.move(35, 1050);
      mark("advance", { index, finalAt: backAt });
    }
    await until(card.at + offset);
    await page.getByTestId("opener-card").click();
    await page.mouse.move(35, 1050);
    mark("reveal", { index, cardId: card.id, cardName: card.name, finalAt: card.at });
    console.log(`Recorded ${index + 1}: ${card.name} at edited ${card.at}s`);
  }
  await until(plan.duration + offset);
  mark("end");
  recording.recordedSeconds = elapsed();
  const final = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), OPENER_STORAGE_KEY);
  assert.equal(final.stage, "complete");
  assert.equal(final.history.length, 11);
  assert.equal(errors.length, 0, errors.join("\n"));
  await page.screenshot({ path: join(folder, "frames", "recorded-charizard.png") });
  const end = elapsed();
  await page.close();
  await context.close();
  const rawPath = join(folder, "recordings", "website-raw.webm");
  await page.video().saveAs(rawPath);
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", rawPath], { encoding: "utf8" }).trim());
  recording.rawVideoSeconds = duration;
  recording.wallClockTrimEstimate = Math.max(0, duration - end);
  // Screencast startup is not the same as Node's wall clock. A marker outside
  // the final crop gives an actual frame based start time for reproducible sync.
  const pixels = execFileSync("ffmpeg", [
    "-v", "error", "-i", rawPath,
    "-vf", "fps=25,crop=8:8:704:1104,scale=1:1",
    "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1",
  ]);
  let firstGreen = -1;
  for (let pixel = 0; pixel < pixels.length; pixel += 3) {
    if (pixels[pixel] < 90 && pixels[pixel + 1] > 160 && pixels[pixel + 2] < 90) {
      firstGreen = pixel / 3;
      break;
    }
  }
  assert.ok(firstGreen >= 0, "The video sync marker must be visible in raw footage");
  recording.trimStart = firstGreen / 25;
  recording.syncMethod = "First green frame of an 8 pixel marker outside the final crop";
  await writeFile(join(folder, "recording-metadata.json"), JSON.stringify(recording, null, 2));
  await writeFile(join(folder, "recorded-session.json"), JSON.stringify(final, null, 2));
  console.log(`Saved ${rawPath}, trim start ${recording.trimStart.toFixed(3)}s`);
} finally {
  await browser.close();
}

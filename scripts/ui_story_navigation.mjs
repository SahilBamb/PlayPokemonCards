import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export async function checkStoryNavigation(
  page,
  baseUrl = "http://127.0.0.1:5203",
) {
  const pathname = () => new URL(page.url()).pathname;
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /^card opener$/i }).click();
  assert.equal(pathname(), "/card-opener");
  await page
    .getByRole("button", { name: "Return to main menu", exact: true })
    .click();
  await page.getByTestId("menu-story").waitFor();
  assert.equal(pathname(), "/");
  await page.getByTestId("menu-story").click();
  await page.getByTestId("story-kanto").waitFor();
  assert.equal(pathname(), "/story-mode");
  await page.goBack();
  await page.getByTestId("menu-story").waitFor();
  assert.equal(pathname(), "/");
  assert.equal(await page.getByTestId("opener-balance").count(), 0);
  await page.goForward();
  await page.getByTestId("story-kanto").waitFor();
  assert.equal(pathname(), "/story-mode");
  await page.reload();
  await page.getByTestId("story-kanto").waitFor();
  assert.equal(pathname(), "/story-mode");
  await page.getByTestId("story-kanto").click();
  await page.getByTestId("to-shop").click();
  await page.getByTestId("shopkeeper-name").waitFor();
  assert.equal(pathname(), "/story-mode");
  await page.goBack();
  await page.getByTestId("menu-story").waitFor();
  assert.equal(pathname(), "/");
  await page.goto(`${baseUrl}/story-mode/`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("story-kanto").waitFor();
  await page
    .getByRole("button", { name: "Back to Main Menu", exact: true })
    .click();
  await page.getByTestId("menu-story").waitFor();
  assert.equal(pathname(), "/");
  await page.goto(`${baseUrl}/story-mode`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Main Menu", exact: true }).click();
  await page.getByTestId("menu-story").waitFor();
  assert.equal(pathname(), "/");
  return "Story URL, opener history, Back, Forward, reload, direct entry and both home actions passed.";
}

if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    console.log(
      await checkStoryNavigation(
        page,
        process.env.PPC_URL || "http://127.0.0.1:5203",
      ),
    );
  } finally {
    await browser.close();
  }
}

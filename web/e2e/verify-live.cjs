const { chromium } = require("@playwright/test");
const { mkdirSync } = require("node:fs");

(async () => {
  mkdirSync("qa-evidence/scale", { recursive: true });
  const BASE = "https://tessera-web-delta.vercel.app";
  const pages = [
    ["borrow", "/borrow"],
    ["transparency", "/transparency"],
    ["agent", "/agent"],
    ["lend", "/lend"],
  ];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  for (const [name, path] of pages) {
    try {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch {}
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `qa-evidence/scale/${name}.png`, fullPage: true });
    console.log("shot", name);
  }
  await browser.close();
})();

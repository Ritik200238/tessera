/* Live-site audit capture: screenshots (desktop+mobile) + console/page errors +
 * failed requests + meta/OG tags + rendered text, per route. Evidence base for
 * the polish audit. Output: qa-evidence/audit/. */
const { chromium } = require("@playwright/test");
const { mkdirSync, writeFileSync } = require("node:fs");

const BASE = process.env.AUDIT_BASE || "https://tessera-web-delta.vercel.app";
const ROUTES = [
  "/", "/dashboard", "/lend", "/borrow", "/agent", "/transparency",
  "/security", "/risk", "/status", "/start", "/explore", "/sandbox",
  "/drill", "/roadmap", "/developers",
];
const VIEWPORTS = { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } };

(async () => {
  mkdirSync("qa-evidence/audit", { recursive: true });
  const browser = await chromium.launch();
  const manifest = {};
  for (const route of ROUTES) {
    const name = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "_");
    const entry = { console: [], pageErrors: [], failedRequests: [], meta: {}, title: "" };
    for (const [vp, size] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({ viewport: size });
      const page = await ctx.newPage();
      page.on("console", (m) => {
        if (m.type() === "error" || m.type() === "warning") entry.console.push(`(${vp})[${m.type()}] ${m.text()}`.slice(0, 280));
      });
      page.on("pageerror", (e) => entry.pageErrors.push(`(${vp}) ${String(e)}`.slice(0, 280)));
      page.on("requestfailed", (r) => {
        const u = r.url();
        if (!u.includes("plausible") && !u.includes("walletconnect") && !u.includes("analytics")) {
          entry.failedRequests.push(`(${vp}) ${r.method()} ${u} — ${r.failure()?.errorText}`.slice(0, 220));
        }
      });
      try {
        await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
      } catch {
        try { await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 }); } catch { /* capture whatever rendered */ }
      }
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `qa-evidence/audit/${name}-${vp}.png`, fullPage: true });
      if (vp === "desktop") {
        entry.title = await page.title().catch(() => "");
        entry.meta = await page.evaluate(() => {
          const g = (s) => document.querySelector(s)?.getAttribute("content") || null;
          return {
            description: g('meta[name="description"]'),
            ogTitle: g('meta[property="og:title"]'),
            ogDescription: g('meta[property="og:description"]'),
            ogImage: g('meta[property="og:image"]'),
            twitterCard: g('meta[name="twitter:card"]'),
          };
        }).catch(() => ({}));
        const text = await page.evaluate(() => document.body.innerText).catch(() => "");
        writeFileSync(`qa-evidence/audit/${name}.txt`, text);
      }
      await ctx.close();
    }
    manifest[route] = entry;
    console.log("captured", route, "| console:", entry.console.length, "pageErr:", entry.pageErrors.length, "failedReq:", entry.failedRequests.length);
  }
  writeFileSync("qa-evidence/audit/manifest.json", JSON.stringify(manifest, null, 2));
  await browser.close();
  console.log("DONE — artifacts in qa-evidence/audit/");
})();

import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Logged-out visual sweep — every route on desktop (1280×800) + mobile
 * (375×812), full-page screenshots to qa-evidence/, with console + page errors
 * captured per route. This is the public/empty-state coverage; connected states
 * + wallet flows are driven separately with the injected personas.
 */
const ROUTES: [string, string][] = [
  ["home", "/"],
  ["lend", "/lend"],
  ["borrow", "/borrow"],
  ["dashboard", "/dashboard"],
  ["risk", "/risk"],
  ["status", "/status"],
  ["transparency", "/transparency"],
  ["security", "/security"],
  ["agent", "/agent"],
];
const EV = "../qa-evidence";
mkdirSync(`${EV}/desktop`, { recursive: true });
mkdirSync(`${EV}/mobile`, { recursive: true });

test("logged-out visual sweep (desktop + mobile)", async ({ browser }) => {
  const errs: Record<string, string[]> = {};
  for (const [name, route] of ROUTES) {
    for (const [device, viewport] of [
      ["desktop", { width: 1280, height: 800 }],
      ["mobile", { width: 375, height: 812 }],
    ] as const) {
      const ctx = await browser.newContext({ viewport, isMobile: device === "mobile" });
      const page = await ctx.newPage();
      const e: string[] = [];
      page.on("console", (m) => m.type() === "error" && e.push(m.text()));
      page.on("pageerror", (err) => e.push(String(err)));
      await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(2800);
      await page.screenshot({ path: `${EV}/${device}/${name}.png`, fullPage: true });
      errs[`${device} ${route}`] = e;
      await ctx.close();
    }
  }
  writeFileSync(`${EV}/console-errors.json`, JSON.stringify(errs, null, 2));
  console.log("SWEEP_DONE");
});

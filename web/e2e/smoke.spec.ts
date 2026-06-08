import { test, expect } from "@playwright/test";
import { installWallet } from "./wallet";
import { personas } from "./personas";
import { mkdirSync } from "node:fs";

const SHOTS = "e2e/.artifacts/smoke";
mkdirSync(SHOTS, { recursive: true });

/**
 * Smoke test: proves the injected real-key wallet harness actually connects a
 * persona to the live dApp (the precondition for every other flow).
 */
test("Alice connects via the injected real-key wallet", async ({ browser }) => {
  const context = await browser.newContext();
  const addr = await installWallet(context, personas.alice.key);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/dashboard");
  await page.waitForTimeout(1500);

  // The injected wallet eager-connects; if it didn't, drive the ConnectKit modal.
  const connectBtn = page.getByRole("button", { name: /^connect wallet$/i });
  if (await connectBtn.isVisible().catch(() => false)) {
    await connectBtn.click();
    await page.waitForTimeout(800);
    await page
      .getByRole("button", { name: /tessera test wallet|metamask|browser wallet|injected/i })
      .first()
      .click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: `${SHOTS}/connected.png`, fullPage: true });

  // Connected = the truncated address shows somewhere in the chrome.
  await expect(page.getByText(new RegExp(addr.slice(0, 6), "i")).first()).toBeVisible({
    timeout: 30_000,
  });

  console.log("connected address:", addr, "pageerrors:", errors.length);
  await context.close();
});

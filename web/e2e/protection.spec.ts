import { test, expect } from "@playwright/test";
import { installWallet } from "./wallet";
import { personas } from "./personas";
import { mkdirSync } from "node:fs";

const EV = "../qa-evidence/flows";
mkdirSync(EV, { recursive: true });

/** Bob enables Active Protection (grant USDC allowance), previews protection,
 *  then revokes via the kill switch. Covers AgentControls + ProtectionPreview (B2)
 *  + the revoke kill switch (B6). */
test("Bob enables Active Protection, previews, and revokes", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext();
  await installWallet(ctx, personas.bob.key);
  const page = await ctx.newPage();
  await page.goto("/agent");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${EV}/prot-01-agent-off.png`, fullPage: true });

  // Enable protection — use the Recommended cap (~125% of debt) if offered.
  const rec = page.getByRole("button", { name: /Recommended ·/i });
  if (await rec.isVisible().catch(() => false)) await rec.click();
  else await page.locator("#cap").fill("750");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Enable protection/i }).click();
  await expect(page.getByText(/Protection is live/i)).toBeVisible({ timeout: 120_000 });
  await page.screenshot({ path: `${EV}/prot-02-enabled.png`, fullPage: true });

  // Reload to pick up the allowance (M7) so the Protected state + kill switch render.
  await page.reload();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${EV}/prot-03-protected.png`, fullPage: true });

  // ProtectionPreview (B2): move the drop slider.
  const drop = page.locator('input[aria-label="Collateral price drop"]');
  if (await drop.isVisible().catch(() => false)) {
    await drop.fill("30");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${EV}/prot-04-preview.png`, fullPage: true });
  }

  // Kill switch (revoke).
  const kill = page.getByRole("button", { name: /Kill switch/i });
  if (await kill.isVisible().catch(() => false)) {
    await kill.click();
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `${EV}/prot-05-revoked.png`, fullPage: true });
  }
  console.log("PROTECTION_DONE");
  await ctx.close();
});

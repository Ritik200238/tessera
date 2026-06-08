import { test, expect } from "@playwright/test";
import { installWallet } from "./wallet";
import { personas } from "./personas";
import { mkdirSync } from "node:fs";

const EV = "../qa-evidence/flows";
mkdirSync(EV, { recursive: true });

/** Alice supplies USDC end-to-end (real approve + deposit txs via injected key). */
test("Alice lends USDC end-to-end", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext();
  await installWallet(ctx, personas.alice.key);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto("/lend");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${EV}/lend-01-connected.png`, fullPage: true });

  await page.locator("#lend-amount").fill("2500");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${EV}/lend-02-amount.png`, fullPage: true });

  let reloadNeeded = false;
  const approveBtn = page.getByRole("button", { name: /approve usdc/i });
  if (await approveBtn.isVisible().catch(() => false)) {
    await approveBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${EV}/lend-03-approving.png`, fullPage: true });
    // The allowance read has no watch; the button may not auto-advance to Supply.
    const supplyVisible = await page
      .getByRole("button", { name: /^supply usdc$/i })
      .isVisible()
      .catch(() => false);
    if (!supplyVisible) {
      await page.waitForTimeout(8000);
      const stillStuck = !(await page
        .getByRole("button", { name: /^supply usdc$/i })
        .isVisible()
        .catch(() => false));
      if (stillStuck) {
        reloadNeeded = true;
        await page.reload();
        await page.waitForTimeout(2500);
        await page.locator("#lend-amount").fill("2500");
        await page.waitForTimeout(600);
      }
    }
  }
  await page.screenshot({ path: `${EV}/lend-04-ready-to-supply.png`, fullPage: true });

  await page.getByRole("button", { name: /^supply usdc$/i }).click();
  await expect(page.getByText(/^Supplied$/i)).toBeVisible({ timeout: 120_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${EV}/lend-05-supplied.png`, fullPage: true });

  console.log("LEND_RESULT", JSON.stringify({ reloadNeeded, errors }));
  await ctx.close();
});

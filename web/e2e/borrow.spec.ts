import { test, expect } from "@playwright/test";
import { installWallet } from "./wallet";
import { personas } from "./personas";
import { mkdirSync } from "node:fs";

const EV = "../qa-evidence/flows";
mkdirSync(EV, { recursive: true });

/** Helper: click a primary button, and if a known "stuck after approve" (M5)
 *  state blocks the next button, reload + restore the amount. */
async function depositCollateral(page: import("@playwright/test").Page) {
  await page.locator("#amount").fill("10"); // 10 tAAPL ≈ $2,000 collateral
  await page.waitForTimeout(500);
  const approve = page.getByRole("button", { name: /approve tAAPL/i });
  if (await approve.isVisible().catch(() => false)) {
    await approve.click();
    await page.waitForTimeout(9000);
    if (!(await page.getByRole("button", { name: /^deposit$/i }).isVisible().catch(() => false))) {
      await page.reload();
      await page.waitForTimeout(2500);
      await page.locator("#amount").fill("10");
      await page.waitForTimeout(500);
    }
  }
  await page.getByRole("button", { name: /^deposit$/i }).click();
  await expect(page.getByText(/Deposit confirmed/i)).toBeVisible({ timeout: 120_000 });
}

test("Bob borrows USDC end-to-end (deposit collateral → borrow)", async ({ browser }) => {
  test.setTimeout(360_000);
  const ctx = await browser.newContext();
  await installWallet(ctx, personas.bob.key);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/borrow");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${EV}/borrow-01-connected.png`, fullPage: true });

  // STEP 1 — deposit tAAPL collateral
  await depositCollateral(page);
  await page.screenshot({ path: `${EV}/borrow-02-collateral-deposited.png`, fullPage: true });

  // STEP 2 — reload so the borrow form picks up the fresh collateral (M7), set LTV, borrow.
  await page.reload();
  await page.waitForTimeout(2500);
  const slider = page.locator('input[aria-label="Target loan-to-value"]');
  await slider.fill("3000"); // 30% LTV → ~$600 borrow
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${EV}/borrow-03-ltv-set.png`, fullPage: true });

  await page.getByRole("button", { name: /^borrow usdc$/i }).click();
  await expect(page.getByText(/Borrow confirmed/i)).toBeVisible({ timeout: 120_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${EV}/borrow-04-borrowed.png`, fullPage: true });

  console.log("BORROW_RESULT", JSON.stringify({ errors: errors.slice(0, 3) }));
  await ctx.close();
});

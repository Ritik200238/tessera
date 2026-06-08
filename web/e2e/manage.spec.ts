import { test, expect } from "@playwright/test";
import { installWallet } from "./wallet";
import { personas } from "./personas";
import { mkdirSync } from "node:fs";

const EV = "../qa-evidence/flows";
mkdirSync(EV, { recursive: true });

test("Bob repays partially + withdraws collateral", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext();
  await installWallet(ctx, personas.bob.key);
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${EV}/manage-01-position.png`, fullPage: true });

  // Repay 200 USDC (Bob already has allowance from the protection grant).
  await page.locator("#repay-amount").fill("200");
  await page.waitForTimeout(600);
  const approve = page.getByRole("button", { name: /^Approve USDC$/i });
  if (await approve.isVisible().catch(() => false)) {
    await approve.click();
    await page.waitForTimeout(9000);
    if (!(await page.getByRole("button", { name: /^Repay$/i }).isVisible().catch(() => false))) {
      await page.reload();
      await page.waitForTimeout(3000);
      await page.locator("#repay-amount").fill("200");
      await page.waitForTimeout(600);
    }
  }
  await page.getByRole("button", { name: /^Repay$/i }).click();
  await expect(page.getByText(/Repayment confirmed/i)).toBeVisible({ timeout: 120_000 });
  await page.screenshot({ path: `${EV}/manage-02-repaid.png`, fullPage: true });

  // Withdraw 2 tAAPL (default token); HF must stay healthy → should succeed.
  await page.reload();
  await page.waitForTimeout(3000);
  await page.locator("#wc-amount").fill("2");
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Withdraw$/i }).click();
  await expect(page.getByText(/Collateral withdrawn/i)).toBeVisible({ timeout: 120_000 });
  await page.screenshot({ path: `${EV}/manage-03-withdrawn.png`, fullPage: true });
  await ctx.close();
});

test("Carol gets test funds via the faucet", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext();
  await installWallet(ctx, personas.carol.key);
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${EV}/faucet-01-before.png`, fullPage: true });
  await page.getByRole("button", { name: /Get test funds/i }).click();
  await expect(page.getByText(/Test funds sent/i)).toBeVisible({ timeout: 120_000 });
  await page.screenshot({ path: `${EV}/faucet-02-sent.png`, fullPage: true });
  await ctx.close();
});

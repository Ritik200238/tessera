import { test, expect } from "@playwright/test";
import { installWallet } from "./wallet";
import { personas } from "./personas";
import { mkdirSync } from "node:fs";

const EV = "../qa-evidence/flows";
mkdirSync(EV, { recursive: true });

/** Negative: withdrawing more USDC than is idle in the pool must be BLOCKED
 *  client-side (before any tx) with a humanized message + disabled button. */
test("Alice: withdraw exceeding pool liquidity is blocked", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext();
  await installWallet(ctx, personas.alice.key);
  const page = await ctx.newPage();
  await page.goto("/lend");
  await page.waitForTimeout(2500);
  await page.getByRole("tab", { name: /withdraw/i }).click();
  await page.locator("#lend-amount").fill("2450");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${EV}/adv-01-withdraw-exceeds-liquidity.png`, fullPage: true });
  await expect(page.getByText(/Exceeds available liquidity/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Withdraw USDC$/i })).toBeDisabled();
  await ctx.close();
});

/** Negative: withdrawing ALL collateral while debt is open breaks the health
 *  factor — the contract must revert, decoded into a humanized error (no raw hex). */
test("Bob: withdrawing all collateral with open debt reverts gracefully", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext();
  await installWallet(ctx, personas.bob.key);
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await page.waitForTimeout(3000);
  await page.locator("#wc-amount").fill("8"); // all remaining tAAPL, with ~250 USDC debt open
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Withdraw$/i }).click();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${EV}/adv-02-withdraw-breaks-hf.png`, fullPage: true });
  await expect(page.getByText(/Transaction failed/i)).toBeVisible({ timeout: 30_000 });
  await ctx.close();
});

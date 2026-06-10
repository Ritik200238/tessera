import { describe, it, expect } from "vitest";
import { action } from "../src/log/action.js";

const ADDR = "0xC7827fBaeEAE5B232C896d96918fF43E2601bD3B" as `0x${string}`;

describe("public action log privacy", () => {
  it("never emits the raw borrower address — only an unlinkable salted ref", () => {
    const a = action.alert(ADDR, 1_100_000_000_000_000_000n, "at-risk", "copy");
    expect(a.kind).toBe("alert");
    if (a.kind !== "alert") return;
    expect(a.user).not.toBe(ADDR);
    // The ref must not leak the address prefix and must be the hashed shape.
    expect(a.user.toLowerCase()).not.toContain(ADDR.slice(2, 12).toLowerCase());
    expect(a.user).toMatch(/^u:[0-9a-f]{10}$/);
  });

  it("is deterministic within a process (stable ref per address)", () => {
    const a1 = action.alert(ADDR, 1_000_000_000_000_000_000n, "at-risk", "x");
    const a2 = action.alert(ADDR, 1_000_000_000_000_000_000n, "at-risk", "y");
    if (a1.kind === "alert" && a2.kind === "alert") expect(a1.user).toBe(a2.user);
  });

  it("rounds USDC repay into 10-USDC bands (no exact distress amounts, matches rationale scale)", () => {
    const liq = action.liquidate({
      user: ADDR,
      tx: "0x0000000000000000000000000000000000000000000000000000000000000000",
      repay: 149_640000n,
      seized: 1n,
      token: ADDR,
      status: "confirmed",
    });
    if (liq.kind === "liquidate") {
      expect(BigInt(liq.repay) % 10_000000n).toBe(0n); // banded
      expect(liq.repay).toBe("150000000"); // ~149.64 → 150, matching the "~150" rationale
    }
  });
});

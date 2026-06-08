import { describe, it, expect } from "vitest";
import { marketRegime, earningsNear, assessRegime } from "../src/strategy/regime.js";

const WAD = 1_000_000_000_000_000_000n;
const BASE_PROTECT = 1_400_000_000_000_000_000n; // 1.4
const BASE_ALERT = 1_100_000_000_000_000_000n; // 1.1
const pct = (n: bigint) => (WAD * n) / 100n;

// Fixed instants (UTC). Jan 2026 is EST (UTC-5); 2026-01-05 is a Monday, 2026-01-03 a Saturday.
const MON_OPEN = new Date("2026-01-05T15:00:00Z"); // Mon 10:00 EST
const MON_EVENING = new Date("2026-01-05T23:00:00Z"); // Mon 18:00 EST
const SATURDAY = new Date("2026-01-03T12:00:00Z");

describe("marketRegime", () => {
  it("open during the NYSE session", () => expect(marketRegime(MON_OPEN)).toBe("open"));
  it("after-hours on a weekday evening", () => expect(marketRegime(MON_EVENING)).toBe("after-hours"));
  it("weekend on Saturday", () => expect(marketRegime(SATURDAY)).toBe("weekend"));
});

describe("earningsNear", () => {
  const cal = { X: ["2026-03-02T00:00:00Z"] };
  it("true within 48h", () => expect(earningsNear(new Date("2026-03-01T00:00:00Z"), cal)).toBe(true));
  it("false when far away", () => expect(earningsNear(new Date("2026-02-01T00:00:00Z"), cal)).toBe(false));
});

describe("assessRegime", () => {
  it("open + no earnings keeps the base targets", () => {
    const r = assessRegime({ now: MON_OPEN, baseProtectHf: BASE_PROTECT, baseAlertHf: BASE_ALERT, earningsCal: {} });
    expect(r.regime).toBe("open");
    expect(r.earningsNear).toBe(false);
    expect(r.protectTargetHf).toBe(BASE_PROTECT);
    expect(r.alertThresholdHf).toBe(BASE_ALERT);
  });
  it("after-hours widens both bands by +0.15", () => {
    const r = assessRegime({ now: MON_EVENING, baseProtectHf: BASE_PROTECT, baseAlertHf: BASE_ALERT, earningsCal: {} });
    expect(r.protectTargetHf).toBe(BASE_PROTECT + pct(15n));
    expect(r.alertThresholdHf).toBe(BASE_ALERT + pct(15n));
  });
  it("weekend widens both bands by +0.30", () => {
    const r = assessRegime({ now: SATURDAY, baseProtectHf: BASE_PROTECT, baseAlertHf: BASE_ALERT, earningsCal: {} });
    expect(r.regime).toBe("weekend");
    expect(r.protectTargetHf).toBe(BASE_PROTECT + pct(30n));
  });
  it("earnings stacks +0.30 on top of the session regime", () => {
    // 2026-03-02 is a Monday (EST); 10:00 EST = open; earnings the next day is within 48h.
    const r = assessRegime({
      now: new Date("2026-03-02T15:00:00Z"),
      baseProtectHf: BASE_PROTECT,
      baseAlertHf: BASE_ALERT,
      earningsCal: { X: ["2026-03-03T00:00:00Z"] },
    });
    expect(r.regime).toBe("open");
    expect(r.earningsNear).toBe(true);
    expect(r.protectTargetHf).toBe(BASE_PROTECT + pct(30n));
    expect(r.label).toContain("earnings");
  });
});

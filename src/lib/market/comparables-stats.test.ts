import { describe, expect, it } from "vitest";
import { comparablesStats } from "./comparables-stats";

describe("comparablesStats", () => {
  it("computes median, range and implied value", () => {
    const s = comparablesStats(
      [
        { priceDebtFree: 30_000_000, livingAreaM2: 50 }, // 6000
        { priceDebtFree: 20_000_000, livingAreaM2: 40 }, // 5000
        { priceDebtFree: 35_000_000, livingAreaM2: 50 }, // 7000
        { priceDebtFree: 27_500_000, livingAreaM2: 50 }, // 5500
      ],
      48,
    )!;
    expect(s.medianPerM2).toBe(575_000);
    expect(s.minPerM2).toBe(500_000);
    expect(s.maxPerM2).toBe(700_000);
    expect(s.impliedValue).toBe(27_600_000);
  });
  it("returns null without data", () => expect(comparablesStats([], 50)).toBeNull());
});

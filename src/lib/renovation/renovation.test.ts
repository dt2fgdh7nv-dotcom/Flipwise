import { describe, expect, it } from "vitest";
import { SEED_CATALOGUE } from "@/lib/costs/seed-catalogue";
import { lineTotals, planTotals, scenarioBudgetsFromPlan, tierPrice } from "./estimate";
import { estimateWallArea, ROOM_TYPES, suggestLines } from "./templates";

const line = (o: Partial<Parameters<typeof lineTotals>[0]> = {}) => ({
  quantity: 4,
  unitPrice: 15_000,
  unitPriceLow: 12_000,
  unitPriceHigh: 18_000,
  laborBps: 6500,
  certification: null,
  needsRenovationNotice: false,
  ...o,
});

describe("estimate", () => {
  it("prices a tier at its midpoint", () => {
    expect(tierPrice({ budgetLow: 100, budgetHigh: 201, midLow: 0, midHigh: 0, premiumLow: 0, premiumHigh: 0 }, "budget")).toEqual({ low: 100, high: 201, typical: 151 });
  });

  it("splits labour and materials", () => {
    expect(lineTotals(line())).toEqual({ total: 60_000, low: 48_000, high: 72_000, labor: 39_000, materials: 21_000 });
  });

  it("sums rooms and collects certifications and notices", () => {
    const t = planTotals([
      { id: "a", lines: [line(), line({ certification: "waterproofing", needsRenovationNotice: true })] },
      { id: "b", lines: [line({ quantity: 1, certification: "electrical" })] },
    ]);
    expect(t.byRoom.a.total).toBe(120_000);
    expect(t.plan.total).toBe(135_000);
    expect(t.certifications).toEqual(["electrical", "waterproofing"]);
    expect(t.noticeLines).toBe(1);
    expect(scenarioBudgetsFromPlan(t.plan)).toEqual({ best: t.plan.low, expected: 135_000, worst: t.plan.high });
  });
});

describe("templates", () => {
  const codes = new Set(SEED_CATALOGUE.map((c) => c.code));

  it("only references catalogue items, for every room type and tier", () => {
    for (const rt of ROOM_TYPES)
      for (const tier of ["budget", "mid", "premium"] as const)
        for (const l of suggestLines(rt, { areaM2: 10, tier, buildYear: 1970, asbestosBeforeYear: 1994 })) expect(codes.has(l.code), `${rt}/${l.code}`).toBe(true);
  });

  it("estimates bathroom quantities from floor area", () => {
    const lines = suggestLines("bathroom", { areaM2: 4, tier: "budget", buildYear: 2000, asbestosBeforeYear: 1994 });
    expect(lines.find((l) => l.code === "bathroom.floor_tiling")!.quantity).toBe(4);
    expect(lines.find((l) => l.code === "bathroom.wall_tiling")!.quantity).toBe(estimateWallArea(4));
    expect(lines.some((l) => l.code === "bathroom.floor_heating")).toBe(false);
  });

  it("picks the floor covering by tier", () => {
    const covering = (tier: "budget" | "mid" | "premium") =>
      suggestLines("bedroom", { areaM2: 10, tier, buildYear: 2000, asbestosBeforeYear: 1994 }).find((l) => l.code.startsWith("flooring.") && l.code !== "flooring.removal")!.code;
    expect([covering("budget"), covering("mid"), covering("premium")]).toEqual(["flooring.laminate", "flooring.vinyl", "flooring.parquet"]);
  });

  it("adds an asbestos survey only for older buildings", () => {
    const has = (y: number) => suggestLines("whole_apartment", { areaM2: 50, tier: "mid", buildYear: y, asbestosBeforeYear: 1994 }).some((l) => l.code === "general.asbestos_survey");
    expect(has(1975)).toBe(true);
    expect(has(1998)).toBe(false);
  });

  it("seed catalogue is internally consistent", () => {
    for (const c of SEED_CATALOGUE) {
      expect(c.budget[0] <= c.budget[1] && c.mid[0] <= c.mid[1] && c.premium[0] <= c.premium[1], c.code).toBe(true);
      expect(c.laborPct).toBeGreaterThanOrEqual(0);
      expect(c.laborPct).toBeLessThanOrEqual(100);
    }
    expect(new Set(SEED_CATALOGUE.map((c) => c.code)).size).toBe(SEED_CATALOGUE.length);
  });
});

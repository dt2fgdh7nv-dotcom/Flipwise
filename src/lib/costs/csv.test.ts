import { describe, expect, it } from "vitest";
import { SEED_CATALOGUE, SEED_PRICE_DATE, SEED_SOURCE } from "./seed-catalogue";
import { parseCostCsv, toCostCsv } from "./csv";

const items = SEED_CATALOGUE.map((s) => ({
  code: s.code,
  category: s.category,
  nameEn: s.nameEn,
  nameFi: s.nameFi,
  unit: s.unit,
  budgetLow: s.budget[0] * 100,
  budgetHigh: s.budget[1] * 100,
  midLow: s.mid[0] * 100,
  midHigh: s.mid[1] * 100,
  premiumLow: s.premium[0] * 100,
  premiumHigh: s.premium[1] * 100,
  laborBps: s.laborPct * 100,
  certification: s.certification ?? null,
  needsRenovationNotice: Boolean(s.needsRenovationNotice),
  priceDate: SEED_PRICE_DATE,
  source: SEED_SOURCE,
  sourceUrl: null,
  notes: s.notes ?? null,
  active: true,
}));

describe("cost catalogue CSV", () => {
  it("round-trips the seed catalogue", () => {
    const { rows, errors } = parseCostCsv(toCostCsv(items));
    expect(errors).toEqual([]);
    expect(rows).toEqual(items);
  });

  it("accepts a single-price list with Finnish formats and falls back to mid for missing tiers", () => {
    const csv = "code;category;name_en;unit;mid_low;mid_high;labor_pct;price_date;source\nbathroom.package;bathroom;Bathroom package;m2;2 400,00;3 100;70 %;1.10.2026;Contractor price list";
    const { rows, errors } = parseCostCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ budgetLow: 240_000, premiumHigh: 310_000, laborBps: 7000, priceDate: "2026-10-01" });
  });

  it("reports invalid rows", () => {
    const { errors } = parseCostCsv("code;category;name_en;unit;mid_low;mid_high;price_date;source\nbad code;kitchen;X;m2;1;2;2026-01-01;src");
    expect(errors[0].line).toBe(2);
  });
});

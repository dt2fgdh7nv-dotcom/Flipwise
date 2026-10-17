import { describe, expect, it } from "vitest";
import { COMPARABLES_CSV_TEMPLATE, parseComparablesCsv, parseDate } from "./comparables";

describe("parseComparablesCsv", () => {
  it("parses the template (semicolon, decimal comma)", () => {
    const { rows, errors } = parseComparablesCsv(COMPARABLES_CSV_TEMPLATE, "CSV import: t.csv");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ postalCode: "00530", buildingType: "apartment", livingAreaM2: 52, priceDebtFree: 33_800_000, saleDate: "2026-08-14", condition: "good", source: "CSV import: t.csv" });
  });

  it("accepts Finnish aliases, comma separator and d.m.yyyy dates; reports bad rows by line", () => {
    const csv = [
      "postal_code,building_type,living_area_m2,price_debt_free_eur,sale_date,condition",
      "06100,rivitalo,89,239000,15.7.2026,hyvä",
      "6100,rt,abc,100000,2026-01-01,",
    ].join("\n");
    const { rows, errors } = parseComparablesCsv(csv, "CSV import: x.csv");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ postalCode: "06100", buildingType: "rowhouse", saleDate: "2026-07-15", condition: "good" });
    expect(errors[0].line).toBe(3);
  });

  it("rejects files with missing columns", () => {
    expect(parseComparablesCsv("a,b\n1,2", "x").errors[0].message).toMatch(/Missing columns/);
  });

  it("parses dates", () => {
    expect(parseDate("1.2.2026")).toBe("2026-02-01");
  });
});

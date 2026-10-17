import { describe, expect, it } from "vitest";
import { parseJsonStat, planQuery, type JsonStat2, type PxMetadata } from "./statfin";

const meta: PxMetadata = {
  title: "Prices per square meter of old dwellings in housing companies by postal code area",
  variables: [
    { code: "Vuosineljännes", text: "Quarter", values: ["2025K4", "2026K1", "2026K2"], valueTexts: ["2025Q4", "2026Q1", "2026Q2"], time: true },
    { code: "Postinumero", text: "Postal code", values: ["00100", "00530"], valueTexts: ["00100 Helsinki keskusta", "00530 Kallio (Helsinki)"] },
    { code: "Talotyyppi", text: "Building type", values: ["0", "1", "3"], valueTexts: ["Building types total", "Blocks of flats", "Terraced houses"] },
    { code: "Tiedot", text: "Information", values: ["keskihinta", "lkm"], valueTexts: ["Price per square meter (EUR/m2)", "Number of sales"] },
  ],
};

describe("StatFin adapter", () => {
  it("plans a query from table metadata", () => {
    const plan = planQuery(meta, "00530", "blocks_of_flats")!;
    expect(plan.areaName).toBe("00530 Kallio (Helsinki)");
    const q = plan.body.query;
    expect(q.find((x) => x.code === "Postinumero")!.selection.values).toEqual(["00530"]);
    expect(q.find((x) => x.code === "Talotyyppi")!.selection.values).toEqual(["1"]);
    expect(q.find((x) => x.code === "Tiedot")!.selection.values).toEqual(["keskihinta", "lkm"]);
  });

  it("returns null for unknown postal codes", () => {
    expect(planQuery(meta, "99999", "all")).toBeNull();
  });

  it("parses JSON-stat2 into a sorted series in cents", () => {
    const ds: JsonStat2 = {
      id: ["Vuosineljännes", "Postinumero", "Talotyyppi", "Tiedot"],
      size: [3, 1, 1, 2],
      value: [6100, 40, 6250.5, 35, null, null],
      updated: "2026-07-01T05:00:00Z",
      dimension: {
        Vuosineljännes: { category: { index: { "2025K4": 0, "2026K1": 1, "2026K2": 2 } } },
        Postinumero: { category: { index: { "00530": 0 } } },
        Talotyyppi: { category: { index: { "1": 0 } } },
        Tiedot: { category: { index: { keskihinta: 0, lkm: 1 } } },
      },
    };
    const pts = parseJsonStat(ds, "Vuosineljännes", "Tiedot", "keskihinta", "lkm");
    expect(pts).toEqual([
      { period: "2025Q4", pricePerM2: 610000, transactions: 40 },
      { period: "2026Q1", pricePerM2: 625050, transactions: 35 },
      { period: "2026Q2", pricePerM2: null, transactions: null },
    ]);
  });
});

import Papa from "papaparse";
import { parseEurToCents } from "@/lib/format";
import { comparableSchema, type ComparableInput } from "@/lib/validation/project";

export const COMPARABLES_CSV_COLUMNS = [
  "street_address",
  "postal_code",
  "municipality",
  "building_type",
  "living_area_m2",
  "rooms",
  "build_year",
  "floor",
  "condition",
  "price_debt_free_eur",
  "sale_date",
  "source_ref",
] as const;

export const COMPARABLES_CSV_TEMPLATE =
  COMPARABLES_CSV_COLUMNS.join(";") +
  "\nEsimerkkikatu 5;00530;Helsinki;apartment;52,0;2;1929;3;good;338000;2026-08-14;Agent sales report\n";

const MAX_ROWS = 500;

const BUILDING_ALIASES: Record<string, ComparableInput["buildingType"]> = {
  apartment: "apartment",
  kerrostalo: "apartment",
  kt: "apartment",
  rowhouse: "rowhouse",
  rivitalo: "rowhouse",
  rt: "rowhouse",
  semi_detached: "semi_detached",
  paritalo: "semi_detached",
  pt: "semi_detached",
};
const CONDITION_ALIASES: Record<string, ComparableInput["condition"]> = {
  good: "good",
  hyvä: "good",
  satisfactory: "satisfactory",
  tyydyttävä: "satisfactory",
  fair: "fair",
  välttävä: "fair",
  poor: "poor",
  huono: "poor",
};

const num = (s: string | undefined) => {
  const v = (s ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/** Accepts ISO dates and Finnish d.m.yyyy. */
export function parseDate(s: string | undefined) {
  const v = (s ?? "").trim();
  const fi = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (fi) return `${fi[3]}-${fi[2].padStart(2, "0")}-${fi[1].padStart(2, "0")}`;
  return v;
}

export interface CsvImportResult {
  rows: ComparableInput[];
  errors: { line: number; message: string }[];
}

/** Parse and validate a comparables CSV (comma or semicolon separated, decimal comma allowed). */
export function parseComparablesCsv(text: string, source: string): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  const errors: CsvImportResult["errors"] = [];
  const rows: ComparableInput[] = [];
  const missing = ["postal_code", "building_type", "living_area_m2", "price_debt_free_eur", "sale_date"].filter((c) => !parsed.meta.fields?.includes(c));
  if (missing.length) return { rows, errors: [{ line: 1, message: `Missing columns: ${missing.join(", ")}` }] };
  if (parsed.data.length > MAX_ROWS) return { rows, errors: [{ line: 1, message: `Too many rows (max ${MAX_ROWS})` }] };

  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const candidate = {
      streetAddress: r.street_address || null,
      postalCode: (r.postal_code ?? "").trim().padStart(5, "0"),
      municipality: r.municipality || null,
      buildingType: BUILDING_ALIASES[(r.building_type ?? "").trim().toLowerCase()],
      livingAreaM2: num(r.living_area_m2),
      rooms: num(r.rooms),
      buildYear: num(r.build_year),
      floor: num(r.floor),
      condition: r.condition ? (CONDITION_ALIASES[r.condition.trim().toLowerCase()] ?? undefined) : null,
      priceDebtFree: parseEurToCents(r.price_debt_free_eur),
      saleDate: parseDate(r.sale_date),
      source,
      sourceRef: r.source_ref || null,
    };
    const res = comparableSchema.safeParse(candidate);
    if (res.success) rows.push(res.data);
    else errors.push({ line, message: res.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ") });
  });
  return { rows, errors };
}

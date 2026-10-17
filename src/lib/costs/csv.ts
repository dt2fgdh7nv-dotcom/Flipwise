import Papa from "papaparse";
import { parseDate } from "@/lib/csv/comparables";
import { parseEurToCents } from "@/lib/format";
import { costItemSchema, type CostItemInput } from "./validation";

/** Cost catalogue CSV (prices in euros excl. VAT). Semicolon or comma separated; decimal comma accepted. */
export const COST_CSV_COLUMNS = [
  "code",
  "category",
  "name_en",
  "name_fi",
  "unit",
  "budget_low",
  "budget_high",
  "mid_low",
  "mid_high",
  "premium_low",
  "premium_high",
  "labor_pct",
  "certification",
  "needs_renovation_notice",
  "price_date",
  "source",
  "source_url",
  "notes",
] as const;

type Row = Record<(typeof COST_CSV_COLUMNS)[number], string>;

const bool = (s: string | undefined) => /^(1|true|yes|kyllä|x)$/i.test((s ?? "").trim());
const pct = (s: string | undefined) => {
  const n = Number((s ?? "").trim().replace(",", ".").replace("%", ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export function parseCostCsv(text: string): { rows: CostItemInput[]; errors: { line: number; message: string }[] } {
  const parsed = Papa.parse<Row>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim().toLowerCase() });
  const missing = ["code", "category", "name_en", "unit", "mid_low", "mid_high", "source", "price_date"].filter((c) => !parsed.meta.fields?.includes(c));
  if (missing.length) return { rows: [], errors: [{ line: 1, message: `Missing columns: ${missing.join(", ")}` }] };
  if (parsed.data.length > 2000) return { rows: [], errors: [{ line: 1, message: "Too many rows (max 2000)" }] };
  const rows: CostItemInput[] = [];
  const errors: { line: number; message: string }[] = [];
  parsed.data.forEach((r, i) => {
    // Missing tier columns fall back to the mid tier so a single-price list still imports.
    const c = (k: keyof Row, fallback?: keyof Row) => parseEurToCents(r[k] || (fallback ? r[fallback] : ""));
    const res = costItemSchema.safeParse({
      code: r.code,
      category: (r.category ?? "").trim(),
      nameEn: r.name_en,
      nameFi: r.name_fi || null,
      unit: (r.unit ?? "").trim().replace("m²", "m2"),
      budgetLow: c("budget_low", "mid_low"),
      budgetHigh: c("budget_high", "mid_high"),
      midLow: c("mid_low"),
      midHigh: c("mid_high"),
      premiumLow: c("premium_low", "mid_low"),
      premiumHigh: c("premium_high", "mid_high"),
      laborBps: r.labor_pct ? pct(r.labor_pct) : 5000,
      certification: r.certification?.trim() || null,
      needsRenovationNotice: bool(r.needs_renovation_notice),
      priceDate: parseDate(r.price_date),
      source: r.source,
      sourceUrl: r.source_url || null,
      notes: r.notes || null,
      active: true,
    });
    if (res.success) rows.push(res.data);
    else errors.push({ line: i + 2, message: res.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
  });
  return { rows, errors };
}

const eur = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");

export function toCostCsv(items: (CostItemInput & { laborBps: number })[]) {
  const data = items.map((i) => ({
    code: i.code,
    category: i.category,
    name_en: i.nameEn,
    name_fi: i.nameFi ?? "",
    unit: i.unit,
    budget_low: eur(i.budgetLow),
    budget_high: eur(i.budgetHigh),
    mid_low: eur(i.midLow),
    mid_high: eur(i.midHigh),
    premium_low: eur(i.premiumLow),
    premium_high: eur(i.premiumHigh),
    labor_pct: String(i.laborBps / 100),
    certification: i.certification ?? "",
    needs_renovation_notice: i.needsRenovationNotice ? "yes" : "no",
    price_date: i.priceDate,
    source: i.source,
    source_url: i.sourceUrl ?? "",
    notes: i.notes ?? "",
  }));
  return Papa.unparse(data, { delimiter: ";", columns: [...COST_CSV_COLUMNS] });
}

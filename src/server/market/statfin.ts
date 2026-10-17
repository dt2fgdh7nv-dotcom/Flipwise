import type { BuildingSegment, MarketPoint, MarketTrendSource } from "./types";

/*
 * Statistics Finland (Tilastokeskus) — PxWeb API, open data (CC BY 4.0).
 * Prices of old dwellings in housing companies (ashi) by postal code area.
 *
 * The adapter is metadata-driven: it reads the table's variables and picks the postal-code,
 * building-type, time and measure dimensions by name, so small table changes don't break it.
 * Table path is configurable (STATFIN_ASHI_TABLE).
 */

const BASE = process.env.STATFIN_PXWEB_BASE ?? "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin";
const TABLE = process.env.STATFIN_ASHI_TABLE ?? "ashi/statfin_ashi_pxt_13mu.px";

export interface PxVariable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
  time?: boolean;
}

export interface PxMetadata {
  title: string;
  variables: PxVariable[];
}

export interface JsonStat2 {
  id: string[];
  size: number[];
  value: (number | null)[];
  updated?: string;
  dimension: Record<string, { label?: string; category: { index: Record<string, number> | string[]; label?: Record<string, string> } }>;
}

const find = (vars: PxVariable[], re: RegExp) => vars.find((v) => re.test(v.code) || re.test(v.text));

export function planQuery(meta: PxMetadata, postalCode: string, segment: BuildingSegment, periods = 24) {
  const postal = find(meta.variables, /postinumero|postal/i);
  const time = meta.variables.find((v) => v.time) ?? find(meta.variables, /vuosi|neljännes|quarter|year/i);
  const building = find(meta.variables, /talotyyppi|building type|type of building/i);
  const measure = find(meta.variables, /tiedot|information|measure/i);
  if (!postal || !time || !measure) return null;

  const postalIdx = postal.values.findIndex((v, i) => v === postalCode || v.startsWith(postalCode) || postal.valueTexts[i]?.startsWith(postalCode));
  if (postalIdx < 0) return null;

  const segmentRe =
    segment === "blocks_of_flats" ? /kerrostalo|blocks? of flats/i : segment === "terraced" ? /rivitalo|terraced|row/i : /yhteensä|total|all/i;
  let buildingValue: string | null = null;
  if (building) {
    const idx = building.valueTexts.findIndex((t) => segmentRe.test(t));
    const fallback = building.valueTexts.findIndex((t) => /yhteensä|total|all/i.test(t));
    buildingValue = building.values[idx >= 0 ? idx : fallback >= 0 ? fallback : 0];
  }

  const priceIdx = measure.valueTexts.findIndex((t) => /neliöhinta|per square|€\/m|eur\/m|price/i.test(t));
  const countIdx = measure.valueTexts.findIndex((t) => /lukumäärä|number of|transactions|sales/i.test(t));
  if (priceIdx < 0) return null;

  const measureValues = [measure.values[priceIdx], ...(countIdx >= 0 ? [measure.values[countIdx]] : [])];
  const query = [
    { code: postal.code, selection: { filter: "item", values: [postal.values[postalIdx]] } },
    { code: time.code, selection: { filter: "top", values: [String(periods)] } },
    { code: measure.code, selection: { filter: "item", values: measureValues } },
    ...(building && buildingValue ? [{ code: building.code, selection: { filter: "item", values: [buildingValue] } }] : []),
  ];
  return {
    body: { query, response: { format: "json-stat2" } },
    timeCode: time.code,
    measureCode: measure.code,
    priceCode: measure.values[priceIdx],
    countCode: countIdx >= 0 ? measure.values[countIdx] : null,
    areaName: postal.valueTexts[postalIdx] ?? null,
    tableTitle: meta.title,
  };
}

/** Parse a JSON-stat2 dataset with one postal code / building type into a time series. */
export function parseJsonStat(ds: JsonStat2, timeCode: string, measureCode: string, priceCode: string, countCode: string | null): MarketPoint[] {
  const cats = (dim: string) => {
    const idx = ds.dimension[dim].category.index;
    return Array.isArray(idx) ? idx : Object.entries(idx).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  };
  const strides = ds.size.map((_, i) => ds.size.slice(i + 1).reduce((a, b) => a * b, 1));
  const pos = (coords: Record<string, number>) => ds.id.reduce((sum, dim, i) => sum + (coords[dim] ?? 0) * strides[i], 0);
  const periods = cats(timeCode);
  const measures = cats(measureCode);
  const pi = measures.indexOf(priceCode);
  const ci = countCode ? measures.indexOf(countCode) : -1;
  return periods
    .map((period, ti) => {
      const price = pi >= 0 ? ds.value[pos({ [timeCode]: ti, [measureCode]: pi })] : null;
      const count = ci >= 0 ? ds.value[pos({ [timeCode]: ti, [measureCode]: ci })] : null;
      return {
        period: period.replace(/^(\d{4})K(\d)$/, "$1Q$2"),
        pricePerM2: price === null || price === undefined ? null : Math.round(price * 100),
        transactions: count === null || count === undefined ? null : Math.round(count),
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

export const statFinAdapter: MarketTrendSource = {
  id: "statfin",
  label: "Statistics Finland",
  async fetchPostalCodeTrend(postalCode, segment) {
    const url = `${BASE}/${TABLE}`;
    const metaRes = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } });
    if (!metaRes.ok) throw new Error(`StatFin metadata ${metaRes.status}`);
    const meta = (await metaRes.json()) as PxMetadata;
    const plan = planQuery(meta, postalCode, segment);
    if (!plan) return null;
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(plan.body),
    });
    if (!res.ok) throw new Error(`StatFin query ${res.status}`);
    const ds = (await res.json()) as JsonStat2;
    return {
      source: "Statistics Finland — Prices of old dwellings in housing companies",
      sourceTable: TABLE,
      sourceUrl: `https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__${TABLE}/`,
      areaCode: postalCode,
      areaName: plan.areaName,
      segment,
      points: parseJsonStat(ds, plan.timeCode, plan.measureCode, plan.priceCode, plan.countCode),
      updatedAt: ds.updated ?? null,
    };
  },
};

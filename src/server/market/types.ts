/**
 * Data source adapter layer.
 *
 * FlipWise never scrapes listing sites (Oikotie, Etuovi) or asuntojen.hintatiedot.fi.
 * Comparable sales come from manual entry and CSV import today; licensed feeds plug in
 * by implementing ComparableSalesSource. Public statistics implement MarketTrendSource.
 * Every value carries its source and date.
 */

export type BuildingSegment = "blocks_of_flats" | "terraced" | "all";

export interface MarketPoint {
  period: string; // "2026Q2" or "2025"
  pricePerM2: number | null; // cents
  transactions: number | null;
}

export interface MarketTrend {
  source: string; // human-readable, e.g. "Statistics Finland"
  sourceTable: string;
  sourceUrl: string;
  areaCode: string;
  areaName: string | null;
  segment: BuildingSegment;
  points: MarketPoint[];
  updatedAt: string | null; // as reported by the source
}

export interface MarketTrendSource {
  id: string;
  label: string;
  fetchPostalCodeTrend(postalCode: string, segment: BuildingSegment): Promise<MarketTrend | null>;
}

export interface ComparableSaleRecord {
  streetAddress: string | null;
  postalCode: string;
  municipality: string | null;
  buildingType: "apartment" | "rowhouse" | "semi_detached";
  livingAreaM2: number;
  rooms: number | null;
  buildYear: number | null;
  floor: number | null;
  priceDebtFree: number; // cents
  saleDate: string;
  sourceRef: string | null;
}

/** Implement for licensed providers (e.g. a contracted transaction-data API). Not scraping. */
export interface ComparableSalesSource {
  id: string;
  label: string;
  licensed: true;
  search(params: { postalCode: string; buildingType: ComparableSaleRecord["buildingType"]; since: string }): Promise<ComparableSaleRecord[]>;
}

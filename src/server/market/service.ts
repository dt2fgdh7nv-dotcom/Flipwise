import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { marketSeriesPoint } from "@/db/schema";
import { statFinAdapter } from "./statfin";
import type { BuildingSegment, MarketTrend } from "./types";

const MAX_AGE_MS = 7 * 86_400_000;
const FAILURE_BACKOFF_MS = 10 * 60_000;
/** In-process backoff so an unreachable source doesn't slow every page view. */
const lastFailure = new Map<string, number>();

export const segmentFor = (buildingType: string): BuildingSegment =>
  buildingType === "apartment" ? "blocks_of_flats" : buildingType === "rowhouse" || buildingType === "semi_detached" ? "terraced" : "all";

export interface CachedTrend {
  trend: MarketTrend | null;
  fetchedAt: Date | null;
  stale: boolean;
  error: string | null;
}

/** Public statistics are cached (not tenant data). Falls back to cached data when the source is unreachable. */
export async function getMarketTrend(postalCode: string, segment: BuildingSegment, opts: { refresh?: boolean } = {}): Promise<CachedTrend> {
  const adapter = statFinAdapter;
  const cached = await db
    .select()
    .from(marketSeriesPoint)
    .where(and(eq(marketSeriesPoint.source, adapter.id), eq(marketSeriesPoint.areaCode, postalCode), eq(marketSeriesPoint.buildingSegment, segment)))
    .orderBy(asc(marketSeriesPoint.period));
  const fetchedAt = cached.length ? new Date(Math.min(...cached.map((c) => c.fetchedAt.getTime()))) : null;
  const fromCache = (): MarketTrend | null =>
    cached.length
      ? {
          source: "Statistics Finland — Prices of old dwellings in housing companies",
          sourceTable: cached[0].sourceTable,
          sourceUrl: `https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__${cached[0].sourceTable}/`,
          areaCode: postalCode,
          areaName: cached[0].areaName,
          segment,
          points: cached.map((c) => ({ period: c.period, pricePerM2: c.pricePerM2, transactions: c.transactions })),
          updatedAt: null,
        }
      : null;

  if (!opts.refresh && fetchedAt && Date.now() - fetchedAt.getTime() < MAX_AGE_MS) {
    return { trend: fromCache(), fetchedAt, stale: false, error: null };
  }
  const key = `${adapter.id}:${postalCode}:${segment}`;
  if (!opts.refresh && Date.now() - (lastFailure.get(key) ?? 0) < FAILURE_BACKOFF_MS) {
    return { trend: fromCache(), fetchedAt, stale: Boolean(cached.length), error: "unreachable" };
  }
  try {
    const trend = await adapter.fetchPostalCodeTrend(postalCode, segment);
    if (!trend) return { trend: fromCache(), fetchedAt, stale: Boolean(cached.length), error: "no_data" };
    const now = new Date();
    for (const p of trend.points) {
      await db
        .insert(marketSeriesPoint)
        .values({ source: adapter.id, sourceTable: trend.sourceTable, areaCode: postalCode, areaName: trend.areaName, buildingSegment: segment, period: p.period, pricePerM2: p.pricePerM2, transactions: p.transactions, fetchedAt: now })
        .onConflictDoUpdate({
          target: [marketSeriesPoint.source, marketSeriesPoint.sourceTable, marketSeriesPoint.areaCode, marketSeriesPoint.buildingSegment, marketSeriesPoint.period],
          set: { pricePerM2: p.pricePerM2, transactions: p.transactions, areaName: trend.areaName, fetchedAt: now },
        });
    }
    return { trend, fetchedAt: now, stale: false, error: null };
  } catch (e) {
    lastFailure.set(key, Date.now());
    console.warn(`[market] ${adapter.id} unavailable:`, (e as Error).message);
    return { trend: fromCache(), fetchedAt, stale: Boolean(cached.length), error: "unreachable" };
  }
}

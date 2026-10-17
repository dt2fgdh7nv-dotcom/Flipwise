import "server-only";
import { eq, isNull, or } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { configValue } from "@/db/schema";
import { resolveConfig, type ConfigRow } from "@/lib/config/resolve";

export const todayInHelsinki = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });

export async function loadConfigRows(orgId: string | null): Promise<ConfigRow[]> {
  const rows = await db
    .select()
    .from(configValue)
    .where(orgId ? or(isNull(configValue.organizationId), eq(configValue.organizationId, orgId)) : isNull(configValue.organizationId));
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export const getEffectiveConfig = cache(async (orgId: string | null) => resolveConfig(await loadConfigRows(orgId), todayInHelsinki()));

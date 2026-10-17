import "server-only";
import { asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { costItem, planLine, planRoom, renovationPlan } from "@/db/schema";
import { planTotals } from "@/lib/renovation/estimate";

export type CostItemRow = typeof costItem.$inferSelect;
export type CatalogueItem = CostItemRow & { scope: "platform" | "override" | "custom"; platformItem: CostItemRow | null };

/**
 * Effective catalogue for a workspace: platform items, with the workspace's price overrides applied,
 * plus the workspace's own custom items. Pass null for the platform view.
 */
export async function getEffectiveCatalogue(orgId: string | null, opts: { includeInactive?: boolean } = {}): Promise<CatalogueItem[]> {
  const rows = await db
    .select()
    .from(costItem)
    .where(orgId ? or(isNull(costItem.organizationId), eq(costItem.organizationId, orgId)) : isNull(costItem.organizationId))
    .orderBy(asc(costItem.category), asc(costItem.code));
  const platform = rows.filter((r) => !r.organizationId);
  const org = rows.filter((r) => r.organizationId);
  const overrides = new Map(org.filter((r) => r.baseItemId).map((r) => [r.baseItemId!, r]));
  const out: CatalogueItem[] = [];
  for (const p of platform) {
    const o = overrides.get(p.id);
    if (o) out.push({ ...o, code: p.code, category: p.category, nameEn: p.nameEn, nameFi: p.nameFi, unit: p.unit, certification: p.certification, needsRenovationNotice: p.needsRenovationNotice, active: p.active, scope: "override", platformItem: p });
    else out.push({ ...p, scope: "platform", platformItem: null });
  }
  for (const c of org.filter((r) => !r.baseItemId)) out.push({ ...c, scope: "custom", platformItem: null });
  return opts.includeInactive ? out : out.filter((i) => i.active);
}

export async function getPlan(projectId: string) {
  const plan = await db.query.renovationPlan.findFirst({
    where: eq(renovationPlan.projectId, projectId),
    with: {
      rooms: {
        orderBy: [asc(planRoom.sortOrder), asc(planRoom.createdAt)],
        with: { lines: { orderBy: [asc(planLine.sortOrder), asc(planLine.createdAt)] } },
      },
    },
  });
  return plan ?? null;
}

export type PlanWithRooms = NonNullable<Awaited<ReturnType<typeof getPlan>>>;

/** Normalised plan rooms/lines + totals for rendering. */
export function planView(plan: PlanWithRooms | null) {
  const rooms = (plan?.rooms ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    roomType: r.roomType,
    areaM2: r.areaM2 === null ? null : Number(r.areaM2),
    lines: r.lines.map((l) => ({
      id: l.id,
      name: l.name,
      code: l.code,
      unit: l.unit,
      quantity: Number(l.quantity),
      tier: l.tier,
      unitPrice: l.unitPrice,
      unitPriceLow: l.unitPriceLow,
      unitPriceHigh: l.unitPriceHigh,
      priceOverridden: l.priceOverridden,
      laborBps: l.laborBps,
      certification: l.certification,
      needsRenovationNotice: l.needsRenovationNotice,
      source: l.source,
    })),
  }));
  return { rooms, totals: planTotals(rooms), defaultTier: plan?.defaultTier ?? ("mid" as const) };
}

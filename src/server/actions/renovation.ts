"use server";
import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { dealAnalysis, dealScenario, planLine, planRoom, property, renovationPlan } from "@/db/schema";
import { QUALITY_TIERS } from "@/lib/costs/validation";
import { planTotals, scenarioBudgetsFromPlan, tierPrice } from "@/lib/renovation/estimate";
import { DEFAULT_ROOM_AREA, ROOM_TYPES, suggestLines } from "@/lib/renovation/templates";
import { runAction, type ActionResult } from "@/server/action";
import { audit } from "@/server/audit";
import { assertProjectAccess, ForbiddenError } from "@/server/authz";
import { getEffectiveConfig } from "@/server/data/config";
import { getEffectiveCatalogue, getPlan, type CatalogueItem } from "@/server/data/costs";

type Tier = (typeof QUALITY_TIERS)[number];

async function assertEditor(projectId: string) {
  const access = await assertProjectAccess(projectId, "edit");
  if (access.kind !== "member") throw new ForbiddenError();
  return access;
}

async function ensurePlan(projectId: string, orgId: string) {
  const existing = await db.query.renovationPlan.findFirst({ where: and(eq(renovationPlan.projectId, projectId), eq(renovationPlan.organizationId, orgId)) });
  if (existing) return existing;
  const [created] = await db.insert(renovationPlan).values({ projectId, organizationId: orgId }).onConflictDoNothing().returning();
  return created ?? (await db.query.renovationPlan.findFirst({ where: eq(renovationPlan.projectId, projectId) }))!;
}

/** Snapshot a catalogue item's price for a tier into line fields. */
function priceFields(item: CatalogueItem, tier: Tier) {
  const p = tierPrice(item, tier);
  return {
    unitPrice: p.typical,
    unitPriceLow: p.low,
    unitPriceHigh: p.high,
    laborBps: item.laborBps,
    certification: item.certification,
    needsRenovationNotice: item.needsRenovationNotice,
    source: item.source,
    priceDate: item.priceDate,
  };
}

function lineFromItem(item: CatalogueItem, tier: Tier, quantity: number) {
  return { costItemId: item.id, code: item.code, name: item.nameEn, unit: item.unit, quantity, tier, priceOverridden: false, ...priceFields(item, tier) };
}

const revalidate = (projectId: string) => revalidatePath(`/app/projects/${projectId}`, "layout");

const roomInput = z.object({
  roomType: z.enum(ROOM_TYPES),
  name: z.string().trim().min(1).max(80),
  areaM2: z.number().positive().max(2000).nullable(),
  includeTypical: z.boolean(),
  tier: z.enum(QUALITY_TIERS),
});

export async function addRoom(projectId: string, input: unknown): Promise<ActionResult<{ added: number }>> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const orgId = access.project.organizationId;
    const data = roomInput.parse(input);
    const plan = await ensurePlan(projectId, orgId);
    const [{ maxOrder }] = await db.select({ maxOrder: max(planRoom.sortOrder) }).from(planRoom).where(eq(planRoom.planId, plan.id));
    const [room] = await db
      .insert(planRoom)
      .values({ planId: plan.id, organizationId: orgId, roomType: data.roomType, name: data.name, areaM2: data.areaM2, sortOrder: (maxOrder ?? 0) + 1 })
      .returning();
    let added = 0;
    if (data.includeTypical) {
      const [catalogue, config, prop] = await Promise.all([
        getEffectiveCatalogue(orgId),
        getEffectiveConfig(orgId),
        db.query.property.findFirst({ where: eq(property.projectId, projectId) }),
      ]);
      const byCode = new Map(catalogue.map((c) => [c.code, c]));
      const area = data.areaM2 ?? (data.roomType === "whole_apartment" ? (prop?.livingAreaM2 ?? DEFAULT_ROOM_AREA.whole_apartment) : DEFAULT_ROOM_AREA[data.roomType]);
      const suggestions = suggestLines(data.roomType, { areaM2: area, tier: data.tier, buildYear: prop?.buildYear ?? 2000, asbestosBeforeYear: config["risk.asbestos_survey_before_year"].value });
      const lines = suggestions.flatMap((s, i) => {
        const item = byCode.get(s.code);
        return item ? [{ ...lineFromItem(item, data.tier, s.quantity), roomId: room.id, planId: plan.id, organizationId: orgId, sortOrder: i }] : [];
      });
      if (lines.length) await db.insert(planLine).values(lines);
      added = lines.length;
    }
    revalidate(projectId);
    return { ok: true, data: { added } };
  });
}

export async function updateRoom(projectId: string, roomId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const data = z.object({ name: z.string().trim().min(1).max(80), areaM2: z.number().positive().max(2000).nullable() }).parse(input);
    const plan = await ensurePlan(projectId, access.project.organizationId);
    await db.update(planRoom).set(data).where(and(eq(planRoom.id, z.uuid().parse(roomId)), eq(planRoom.planId, plan.id)));
    revalidate(projectId);
    return { ok: true };
  });
}

export async function deleteRoom(projectId: string, roomId: string): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const plan = await ensurePlan(projectId, access.project.organizationId);
    await db.delete(planRoom).where(and(eq(planRoom.id, z.uuid().parse(roomId)), eq(planRoom.planId, plan.id)));
    revalidate(projectId);
    return { ok: true };
  });
}

export async function addLine(projectId: string, roomId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const orgId = access.project.organizationId;
    const data = z.object({ costItemId: z.uuid(), quantity: z.number().positive().max(100_000), tier: z.enum(QUALITY_TIERS) }).parse(input);
    const plan = await ensurePlan(projectId, orgId);
    const room = await db.query.planRoom.findFirst({ where: and(eq(planRoom.id, z.uuid().parse(roomId)), eq(planRoom.planId, plan.id)) });
    if (!room) throw new ForbiddenError();
    const item = (await getEffectiveCatalogue(orgId)).find((c) => c.id === data.costItemId);
    if (!item) return { ok: false, error: "That item is not in your cost database." };
    const [{ maxOrder }] = await db.select({ maxOrder: max(planLine.sortOrder) }).from(planLine).where(eq(planLine.roomId, room.id));
    await db.insert(planLine).values({ ...lineFromItem(item, data.tier, data.quantity), roomId: room.id, planId: plan.id, organizationId: orgId, sortOrder: (maxOrder ?? 0) + 1 });
    revalidate(projectId);
    return { ok: true };
  });
}

const lineUpdate = z.object({
  quantity: z.number().positive().max(100_000).optional(),
  tier: z.enum(QUALITY_TIERS).optional(),
  /** Custom unit price (cents excl. VAT); null resets to the catalogue price. */
  unitPrice: z.number().int().min(0).max(100_000_000).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function updateLine(projectId: string, lineId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const orgId = access.project.organizationId;
    const data = lineUpdate.parse(input);
    const plan = await ensurePlan(projectId, orgId);
    const line = await db.query.planLine.findFirst({ where: and(eq(planLine.id, z.uuid().parse(lineId)), eq(planLine.planId, plan.id)) });
    if (!line) throw new ForbiddenError();
    const patch: Partial<typeof planLine.$inferInsert> = {};
    if (data.quantity !== undefined) patch.quantity = data.quantity;
    if (data.notes !== undefined) patch.notes = data.notes;
    const tier = data.tier ?? line.tier;
    if (data.tier !== undefined) patch.tier = data.tier;
    if (data.unitPrice !== undefined && data.unitPrice !== null) {
      patch.unitPrice = data.unitPrice;
      patch.unitPriceLow = data.unitPrice;
      patch.unitPriceHigh = data.unitPrice;
      patch.priceOverridden = true;
      patch.source = "Custom price";
    } else if (data.tier !== undefined || data.unitPrice === null) {
      // Re-price from the catalogue for the (new) tier.
      const item = line.costItemId ? (await getEffectiveCatalogue(orgId, { includeInactive: true })).find((c) => c.id === line.costItemId) : undefined;
      if (item) Object.assign(patch, priceFields(item, tier), { priceOverridden: false });
    }
    await db.update(planLine).set(patch).where(eq(planLine.id, line.id));
    revalidate(projectId);
    return { ok: true };
  });
}

export async function deleteLine(projectId: string, lineId: string): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const plan = await ensurePlan(projectId, access.project.organizationId);
    await db.delete(planLine).where(and(eq(planLine.id, z.uuid().parse(lineId)), eq(planLine.planId, plan.id)));
    revalidate(projectId);
    return { ok: true };
  });
}

/** Re-snapshot all lines (except custom prices) from the current catalogue. */
export async function refreshPlanPrices(projectId: string): Promise<ActionResult<{ updated: number }>> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const orgId = access.project.organizationId;
    const plan = await ensurePlan(projectId, orgId);
    const [lines, catalogue] = await Promise.all([db.select().from(planLine).where(eq(planLine.planId, plan.id)), getEffectiveCatalogue(orgId, { includeInactive: true })]);
    const byId = new Map(catalogue.map((c) => [c.id, c]));
    let updated = 0;
    for (const l of lines) {
      const item = l.costItemId ? byId.get(l.costItemId) : undefined;
      if (!item || l.priceOverridden) continue;
      await db.update(planLine).set(priceFields(item, l.tier)).where(eq(planLine.id, l.id));
      updated += 1;
    }
    revalidate(projectId);
    return { ok: true, data: { updated } };
  });
}

/** Change every line's tier (keeps custom prices) and the plan default. */
export async function setPlanTier(projectId: string, tier: string): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const orgId = access.project.organizationId;
    const t = z.enum(QUALITY_TIERS).parse(tier);
    const plan = await ensurePlan(projectId, orgId);
    await db.update(renovationPlan).set({ defaultTier: t }).where(eq(renovationPlan.id, plan.id));
    const [lines, catalogue] = await Promise.all([db.select().from(planLine).where(eq(planLine.planId, plan.id)), getEffectiveCatalogue(orgId, { includeInactive: true })]);
    const byId = new Map(catalogue.map((c) => [c.id, c]));
    for (const l of lines) {
      const item = l.costItemId ? byId.get(l.costItemId) : undefined;
      await db
        .update(planLine)
        .set(item && !l.priceOverridden ? { tier: t, ...priceFields(item, t) } : { tier: t })
        .where(eq(planLine.id, l.id));
    }
    revalidate(projectId);
    return { ok: true };
  });
}

/** Push plan totals into the deal: best = low end, expected = typical, worst = high end of the ranges. */
export async function applyPlanToDeal(projectId: string): Promise<ActionResult<{ best: number; expected: number; worst: number }>> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const orgId = access.project.organizationId;
    const plan = await getPlan(projectId);
    if (!plan || plan.organizationId !== orgId) return { ok: false, error: "Add rooms to the plan first." };
    const totals = planTotals(plan.rooms.map((r) => ({ id: r.id, lines: r.lines.map((l) => ({ ...l, quantity: Number(l.quantity) })) })));
    if (totals.plan.total === 0) return { ok: false, error: "The plan is empty." };
    const budgets = scenarioBudgetsFromPlan(totals.plan);
    const deal = await db.query.dealAnalysis.findFirst({ where: and(eq(dealAnalysis.projectId, projectId), eq(dealAnalysis.organizationId, orgId)) });
    if (!deal) return { ok: false, error: "No deal analysis for this project." };
    for (const kind of ["best", "expected", "worst"] as const) {
      await db.update(dealScenario).set({ renovationBudget: budgets[kind] }).where(and(eq(dealScenario.dealAnalysisId, deal.id), eq(dealScenario.kind, kind)));
    }
    await audit({ organizationId: orgId, actorId: access.user.id, action: "plan.apply_to_deal", entityType: "project", entityId: projectId, metadata: budgets });
    revalidate(projectId);
    return { ok: true, data: budgets };
  });
}

"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { costItem } from "@/db/schema";
import { parseCostCsv } from "@/lib/costs/csv";
import { costItemSchema, costPricesSchema } from "@/lib/costs/validation";
import { runAction, type ActionResult } from "@/server/action";
import { audit } from "@/server/audit";
import { assertOrg, assertPlatformAdmin, ForbiddenError } from "@/server/authz";

const revalidate = () => {
  revalidatePath("/app/costs");
  revalidatePath("/admin/costs");
};

/* ---------------- Workspace (tenant) ---------------- */

/** Workspace admins override a platform item's prices for their workspace. */
export async function saveOrgOverride(platformItemId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await assertOrg("admin");
    const prices = costPricesSchema.parse(input);
    const base = await db.query.costItem.findFirst({ where: and(eq(costItem.id, z.uuid().parse(platformItemId)), isNull(costItem.organizationId)) });
    if (!base) throw new ForbiddenError();
    const existing = await db.query.costItem.findFirst({ where: and(eq(costItem.organizationId, ctx.org.id), eq(costItem.baseItemId, base.id)) });
    if (existing) {
      await db.update(costItem).set({ ...prices, updatedBy: ctx.user.id }).where(eq(costItem.id, existing.id));
    } else {
      await db.insert(costItem).values({
        ...prices,
        organizationId: ctx.org.id,
        baseItemId: base.id,
        code: base.code,
        category: base.category,
        nameEn: base.nameEn,
        nameFi: base.nameFi,
        unit: base.unit,
        certification: base.certification,
        needsRenovationNotice: base.needsRenovationNotice,
        updatedBy: ctx.user.id,
      });
    }
    await audit({ organizationId: ctx.org.id, actorId: ctx.user.id, action: "cost.override", entityType: "cost_item", entityId: base.code });
    revalidate();
    return { ok: true };
  });
}

/** Remove a workspace override or delete a workspace's custom item. */
export async function deleteOrgCostItem(itemId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await assertOrg("admin");
    await db.delete(costItem).where(and(eq(costItem.id, z.uuid().parse(itemId)), eq(costItem.organizationId, ctx.org.id)));
    await audit({ organizationId: ctx.org.id, actorId: ctx.user.id, action: "cost.delete", entityType: "cost_item", entityId: itemId });
    revalidate();
    return { ok: true };
  });
}

export async function createOrgCustomItem(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await assertOrg("admin");
    const data = costItemSchema.parse(input);
    const code = data.code.startsWith("custom.") ? data.code : `custom.${data.code.split(".")[1]}`;
    const clash = await db.query.costItem.findFirst({ where: and(eq(costItem.organizationId, ctx.org.id), eq(costItem.code, code)) });
    if (clash) return { ok: false, error: "An item with this code already exists.", fieldErrors: { code: ["Already in use"] } };
    await db.insert(costItem).values({ ...data, code, organizationId: ctx.org.id, updatedBy: ctx.user.id });
    revalidate();
    return { ok: true };
  });
}

/* ---------------- Platform ---------------- */

export async function savePlatformItem(itemId: string | null, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertPlatformAdmin();
    const data = costItemSchema.parse(input);
    if (itemId) {
      const row = await db.query.costItem.findFirst({ where: and(eq(costItem.id, z.uuid().parse(itemId)), isNull(costItem.organizationId)) });
      if (!row) throw new ForbiddenError();
      if (row.code !== data.code) return { ok: false, error: "The code of an existing item can't be changed.", fieldErrors: { code: ["Can't be changed"] } };
      await db.update(costItem).set({ ...data, updatedBy: admin.id }).where(eq(costItem.id, row.id));
    } else {
      const clash = await db.query.costItem.findFirst({ where: and(isNull(costItem.organizationId), eq(costItem.code, data.code)) });
      if (clash) return { ok: false, error: "An item with this code already exists.", fieldErrors: { code: ["Already in use"] } };
      await db.insert(costItem).values({ ...data, organizationId: null, updatedBy: admin.id });
    }
    await audit({ organizationId: null, actorId: admin.id, action: itemId ? "cost.platform.update" : "cost.platform.create", entityType: "cost_item", entityId: data.code });
    revalidate();
    return { ok: true };
  });
}

/** Upsert platform items by code from a CSV price list. */
export async function importPlatformCostCsv(fileName: string, text: string): Promise<ActionResult<{ created: number; updated: number; errors: { line: number; message: string }[] }>> {
  return runAction(async () => {
    const admin = await assertPlatformAdmin();
    if (text.length > 2_000_000) return { ok: false, error: "File is too large (max 2 MB)." };
    const { rows, errors } = parseCostCsv(text);
    let created = 0;
    let updated = 0;
    for (const r of rows) {
      const existing = await db.query.costItem.findFirst({ where: and(isNull(costItem.organizationId), eq(costItem.code, r.code)) });
      if (existing) {
        await db.update(costItem).set({ ...r, updatedBy: admin.id }).where(eq(costItem.id, existing.id));
        updated += 1;
      } else {
        await db.insert(costItem).values({ ...r, organizationId: null, updatedBy: admin.id });
        created += 1;
      }
    }
    await audit({ organizationId: null, actorId: admin.id, action: "cost.platform.import", entityType: "cost_item", metadata: { file: fileName.slice(0, 120), created, updated, errors: errors.length } });
    revalidate();
    return { ok: true, data: { created, updated, errors } };
  });
}

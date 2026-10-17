"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { configValue, invitation, member, organization } from "@/db/schema";
import { CONFIG_DEFINITION_BY_KEY, CONFIG_KEYS } from "@/lib/config/definitions";
import { configFromInput } from "@/lib/config/units";
import { runAction, type ActionResult } from "@/server/action";
import { audit } from "@/server/audit";
import { auth } from "@/server/auth";
import { assertOrg, assertPlatformAdmin, ForbiddenError } from "@/server/authz";

export async function updateWorkspace(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await assertOrg("admin");
    const data = z
      .object({
        name: z.string().trim().min(2).max(80),
        defaultTaxProfile: z.enum(["company", "individual"]),
        vatDisplay: z.enum(["excl", "incl"]),
        vatDeductible: z.boolean(),
      })
      .parse(input);
    await db.update(organization).set(data).where(eq(organization.id, ctx.org.id));
    await audit({ organizationId: ctx.org.id, actorId: ctx.user.id, action: "organization.update", entityType: "organization", entityId: ctx.org.id, metadata: data });
    revalidatePath("/app", "layout");
    return { ok: true };
  });
}

export async function inviteMember(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await assertOrg("admin");
    const { email, role } = z.object({ email: z.email().transform((e) => e.trim().toLowerCase()), role: z.enum(["member", "admin"]) }).parse(input);
    await auth.api.createInvitation({ body: { email, role, organizationId: ctx.org.id }, headers: await headers() });
    await audit({ organizationId: ctx.org.id, actorId: ctx.user.id, action: "member.invite", entityType: "organization", entityId: ctx.org.id, metadata: { email, role } });
    revalidatePath("/app/settings/members");
    return { ok: true };
  });
}

export async function cancelInvite(invitationId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await assertOrg("admin");
    await db.update(invitation).set({ status: "canceled" }).where(and(eq(invitation.id, z.string().min(1).parse(invitationId)), eq(invitation.organizationId, ctx.org.id)));
    revalidatePath("/app/settings/members");
    return { ok: true };
  });
}

export async function changeMemberRole(memberId: string, role: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await assertOrg("admin");
    const next = z.enum(["member", "admin", "owner"]).parse(role);
    const target = await db.query.member.findFirst({ where: and(eq(member.id, memberId), eq(member.organizationId, ctx.org.id)) });
    if (!target) throw new ForbiddenError();
    // Only owners can grant or revoke ownership, and the last owner can't be demoted.
    if ((next === "owner" || target.role === "owner") && ctx.role !== "owner") throw new ForbiddenError("Only owners can change ownership");
    if (target.role === "owner" && next !== "owner") {
      const owners = await db.select({ id: member.id }).from(member).where(and(eq(member.organizationId, ctx.org.id), eq(member.role, "owner")));
      if (owners.length <= 1) return { ok: false, error: "A workspace needs at least one owner." };
    }
    await db.update(member).set({ role: next }).where(eq(member.id, target.id));
    await audit({ organizationId: ctx.org.id, actorId: ctx.user.id, action: "member.role", entityType: "member", entityId: target.id, metadata: { from: target.role, to: next } });
    revalidatePath("/app/settings/members");
    return { ok: true };
  });
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await assertOrg("admin");
    const target = await db.query.member.findFirst({ where: and(eq(member.id, memberId), eq(member.organizationId, ctx.org.id)) });
    if (!target) throw new ForbiddenError();
    if (target.role === "owner") return { ok: false, error: "Owners can't be removed. Transfer ownership first." };
    if (target.userId === ctx.user.id) return { ok: false, error: "You can't remove yourself." };
    await db.delete(member).where(eq(member.id, target.id));
    await audit({ organizationId: ctx.org.id, actorId: ctx.user.id, action: "member.remove", entityType: "member", entityId: target.id });
    revalidatePath("/app/settings/members");
    return { ok: true };
  });
}

const configInput = z.object({
  key: z.enum(CONFIG_KEYS),
  value: z.string(),
  validFrom: z.iso.date(),
  source: z.string().trim().min(2).max(200),
  sourceUrl: z
    .url()
    .or(z.literal(""))
    .nullish()
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => v || null),
});

function parseConfig(input: unknown) {
  const data = configInput.parse(input);
  const def = CONFIG_DEFINITION_BY_KEY[data.key];
  const value = configFromInput(data.value, def.unit);
  if (value === null || value < 0) throw new z.ZodError([{ code: "custom", path: ["value"], message: "Enter a valid number", input: data.value }]);
  return { ...data, value, unit: def.unit };
}

/** Org admins add a workspace-level override (a new row; history is kept). */
export async function setConfigOverride(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await assertOrg("admin");
    const data = parseConfig(input);
    await db.insert(configValue).values({ ...data, organizationId: ctx.org.id, updatedBy: ctx.user.id });
    await audit({ organizationId: ctx.org.id, actorId: ctx.user.id, action: "config.override", entityType: "config", entityId: data.key, metadata: { value: data.value, validFrom: data.validFrom } });
    revalidatePath("/app", "layout");
    return { ok: true };
  });
}

export async function removeConfigOverrides(key: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await assertOrg("admin");
    const k = z.enum(CONFIG_KEYS).parse(key);
    await db.delete(configValue).where(and(eq(configValue.organizationId, ctx.org.id), eq(configValue.key, k)));
    await audit({ organizationId: ctx.org.id, actorId: ctx.user.id, action: "config.override.remove", entityType: "config", entityId: k });
    revalidatePath("/app", "layout");
    return { ok: true };
  });
}

/** Platform admins add a new versioned platform default. */
export async function setPlatformConfig(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertPlatformAdmin();
    const data = parseConfig(input);
    await db.insert(configValue).values({ ...data, organizationId: null, updatedBy: admin.id });
    await audit({ organizationId: null, actorId: admin.id, action: "config.platform", entityType: "config", entityId: data.key, metadata: { value: data.value, validFrom: data.validFrom } });
    revalidatePath("/app", "layout");
    return { ok: true };
  });
}

export async function deletePlatformConfigVersion(rowId: string): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertPlatformAdmin();
    const row = await db.query.configValue.findFirst({ where: and(eq(configValue.id, z.uuid().parse(rowId)), isNull(configValue.organizationId)) });
    if (!row) throw new ForbiddenError();
    const versions = await db.select({ id: configValue.id }).from(configValue).where(and(eq(configValue.key, row.key), isNull(configValue.organizationId)));
    if (versions.length <= 1) return { ok: false, error: "Can't delete the only version of a setting." };
    await db.delete(configValue).where(eq(configValue.id, row.id));
    await audit({ organizationId: null, actorId: admin.id, action: "config.platform.delete", entityType: "config", entityId: row.key });
    revalidatePath("/app", "layout");
    return { ok: true };
  });
}

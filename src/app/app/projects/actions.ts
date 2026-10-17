"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { comparableSale, dealAnalysis, dealScenario, housingCompany, manualRisk, plannedMaintenance, project, projectStatusEvent, property } from "@/db/schema";
import { parseComparablesCsv } from "@/lib/csv/comparables";
import { deriveScenarios } from "@/lib/finance/deal-engine";
import { comparableSchema, dealSchema, housingCompanySchema, maintenanceSchema, newProjectSchema, propertySchema } from "@/lib/validation/project";
import { runAction, type ActionResult } from "@/server/action";
import { audit } from "@/server/audit";
import { assertOrg, assertProjectAccess, ForbiddenError, hasRole } from "@/server/authz";
import { getEffectiveConfig, todayInHelsinki } from "@/server/data/config";
import { getMarketTrend, segmentFor } from "@/server/market/service";

const PROJECT_STATUSES = ["lead", "analyzing", "offer_made", "purchased", "renovating", "listed", "sold"] as const;

async function assertEditor(projectId: string) {
  const access = await assertProjectAccess(projectId, "edit");
  if (access.kind !== "member") throw new ForbiddenError();
  return access;
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await assertOrg("member");
    const data = newProjectSchema.parse(input);
    const config = await getEffectiveConfig(ctx.org.id);
    const p = data.property;
    const name = data.name ?? [p.streetAddress, p.unit].filter(Boolean).join(" ");

    const id = await db.transaction(async (tx) => {
      const [proj] = await tx
        .insert(project)
        .values({ organizationId: ctx.org.id, name, status: "lead", createdBy: ctx.user.id })
        .returning({ id: project.id });
      await tx.insert(projectStatusEvent).values({ projectId: proj.id, toStatus: "lead", changedBy: ctx.user.id });
      await tx.insert(property).values({ ...p, projectId: proj.id, organizationId: ctx.org.id });
      if (p.ownershipForm === "housing_company_share") {
        await tx.insert(housingCompany).values({ projectId: proj.id, organizationId: ctx.org.id });
      }
      const [deal] = await tx
        .insert(dealAnalysis)
        .values({
          projectId: proj.id,
          organizationId: ctx.org.id,
          askingPrice: data.askingPrice,
          debtShare: p.ownershipForm === "housing_company_share" ? data.debtShare : 0,
          maintenanceFeeMonthly: data.maintenanceFeeMonthly,
          financingFeeMonthly: data.financingFeeMonthly,
          utilitiesMonthly: config["deal.default.utilities_monthly"].value,
          agentFeeBps: config["deal.default.agent_fee"].value,
          loanToValueBps: config["deal.default.loan_to_value"].value,
          taxProfile: ctx.org.defaultTaxProfile,
        })
        .returning({ id: dealAnalysis.id });
      const scenarios = deriveScenarios({
        salePriceDebtFree: data.expectedSalePrice,
        renovationBudget: data.renovationBudget,
        contingencyBps: config["deal.default.contingency"].value,
        holdingMonths: data.holdingMonths,
        interestRateBps: config["deal.default.interest_rate"].value,
      });
      await tx.insert(dealScenario).values(scenarios.map((s) => ({ ...s, dealAnalysisId: deal.id })));
      return proj.id;
    });

    await audit({ organizationId: ctx.org.id, actorId: ctx.user.id, action: "project.create", entityType: "project", entityId: id });
    revalidatePath("/app", "layout");
    return { ok: true, data: { id } };
  });
}

export async function updateProperty(projectId: string, input: unknown & { name?: unknown }): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const { name, ...rest } = z.object({ name: z.string().trim().min(1).max(120) }).passthrough().parse(input);
    const data = propertySchema.parse(rest);
    const orgId = access.project.organizationId;
    await db.transaction(async (tx) => {
      await tx.update(project).set({ name }).where(and(eq(project.id, projectId), eq(project.organizationId, orgId)));
      await tx.update(property).set(data).where(and(eq(property.projectId, projectId), eq(property.organizationId, orgId)));
      if (data.ownershipForm === "housing_company_share") {
        await tx.insert(housingCompany).values({ projectId, organizationId: orgId }).onConflictDoNothing();
      }
    });
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true };
  });
}

export async function updateDeal(projectId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const { scenarios, ...deal } = dealSchema.parse(input);
    const orgId = access.project.organizationId;
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(dealAnalysis)
        .set(deal)
        .where(and(eq(dealAnalysis.projectId, projectId), eq(dealAnalysis.organizationId, orgId)))
        .returning({ id: dealAnalysis.id });
      if (!row) throw new ForbiddenError();
      for (const s of scenarios) {
        await tx
          .insert(dealScenario)
          .values({ ...s, dealAnalysisId: row.id })
          .onConflictDoUpdate({ target: [dealScenario.dealAnalysisId, dealScenario.kind], set: { ...s, updatedAt: new Date() } });
      }
    });
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true };
  });
}

export async function updateStatus(projectId: string, status: string): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const next = z.enum(PROJECT_STATUSES).parse(status);
    const p = access.project;
    if (p.status === next) return { ok: true };
    const today = todayInHelsinki();
    await db
      .update(project)
      .set({
        status: next,
        statusChangedAt: new Date(),
        purchasedAt: next === "purchased" && !p.purchasedAt ? today : p.purchasedAt,
        listedAt: next === "listed" && !p.listedAt ? today : p.listedAt,
        soldAt: next === "sold" && !p.soldAt ? today : p.soldAt,
      })
      .where(and(eq(project.id, projectId), eq(project.organizationId, p.organizationId)));
    await db.insert(projectStatusEvent).values({ projectId, fromStatus: p.status, toStatus: next, changedBy: access.user.id });
    revalidatePath("/app", "layout");
    return { ok: true };
  });
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    if (access.kind !== "member" || (!hasRole(access, "admin") && access.project.createdBy !== access.user.id)) {
      throw new ForbiddenError("Only admins or the creator can delete a project");
    }
    await db.delete(project).where(and(eq(project.id, projectId), eq(project.organizationId, access.project.organizationId)));
    await audit({ organizationId: access.project.organizationId, actorId: access.user.id, action: "project.delete", entityType: "project", entityId: projectId, metadata: { name: access.project.name } });
    revalidatePath("/app", "layout");
    return { ok: true };
  });
}

const manualRiskSchema = z.object({
  title: z.string().trim().min(2).max(160),
  detail: z.string().trim().max(2000).nullish().transform((v) => v || null),
  severity: z.enum(["info", "medium", "high"]),
});

export async function addManualRisk(projectId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const data = manualRiskSchema.parse(input);
    await db.insert(manualRisk).values({ ...data, projectId, organizationId: access.project.organizationId, createdBy: access.user.id });
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true };
  });
}

export async function deleteManualRisk(projectId: string, riskId: string): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    await db
      .delete(manualRisk)
      .where(and(eq(manualRisk.id, z.uuid().parse(riskId)), eq(manualRisk.projectId, projectId), eq(manualRisk.organizationId, access.project.organizationId)));
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true };
  });
}

export async function saveHousingCompany(projectId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const data = housingCompanySchema.parse(input);
    const orgId = access.project.organizationId;
    await db
      .insert(housingCompany)
      .values({ ...data, projectId, organizationId: orgId })
      .onConflictDoUpdate({ target: housingCompany.projectId, set: { ...data, updatedAt: new Date() }, where: eq(housingCompany.organizationId, orgId) });
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true };
  });
}

async function housingCompanyFor(projectId: string, orgId: string) {
  const hc = await db.query.housingCompany.findFirst({ where: and(eq(housingCompany.projectId, projectId), eq(housingCompany.organizationId, orgId)) });
  if (hc) return hc;
  const [created] = await db.insert(housingCompany).values({ projectId, organizationId: orgId }).returning();
  return created;
}

export async function addMaintenanceItem(projectId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const data = maintenanceSchema.parse(input);
    const hc = await housingCompanyFor(projectId, access.project.organizationId);
    await db.insert(plannedMaintenance).values({ ...data, housingCompanyId: hc.id, organizationId: access.project.organizationId });
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true };
  });
}

export async function deleteMaintenanceItem(projectId: string, itemId: string): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const hc = await housingCompanyFor(projectId, access.project.organizationId);
    await db
      .delete(plannedMaintenance)
      .where(and(eq(plannedMaintenance.id, z.uuid().parse(itemId)), eq(plannedMaintenance.housingCompanyId, hc.id), eq(plannedMaintenance.organizationId, access.project.organizationId)));
    revalidatePath(`/app/projects/${projectId}`, "layout");
    return { ok: true };
  });
}

export async function addComparable(projectId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    const data = comparableSchema.parse(input);
    await db.insert(comparableSale).values({ ...data, projectId, organizationId: access.project.organizationId, enteredBy: access.user.id });
    revalidatePath(`/app/projects/${projectId}/comparables`);
    return { ok: true };
  });
}

export async function deleteComparable(projectId: string, comparableId: string): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    await db
      .delete(comparableSale)
      .where(and(eq(comparableSale.id, z.uuid().parse(comparableId)), eq(comparableSale.projectId, projectId), eq(comparableSale.organizationId, access.project.organizationId)));
    revalidatePath(`/app/projects/${projectId}/comparables`);
    return { ok: true };
  });
}

export async function importComparablesCsv(
  projectId: string,
  fileName: string,
  text: string,
): Promise<ActionResult<{ imported: number; errors: { line: number; message: string }[] }>> {
  return runAction(async () => {
    const access = await assertEditor(projectId);
    if (text.length > 1_000_000) return { ok: false, error: "File is too large (max 1 MB)." };
    const name = z.string().trim().min(1).max(120).parse(fileName).replace(/[^\w.\- ]/g, "_");
    const { rows, errors } = parseComparablesCsv(text, `CSV import: ${name}`);
    if (rows.length) {
      await db.insert(comparableSale).values(rows.map((r) => ({ ...r, projectId, organizationId: access.project.organizationId, enteredBy: access.user.id })));
    }
    await audit({ organizationId: access.project.organizationId, actorId: access.user.id, action: "comparables.import", entityType: "project", entityId: projectId, metadata: { file: name, imported: rows.length, errors: errors.length } });
    revalidatePath(`/app/projects/${projectId}/comparables`);
    return { ok: true, data: { imported: rows.length, errors } };
  });
}

export async function refreshMarketTrend(projectId: string): Promise<ActionResult<{ error: string | null }>> {
  return runAction(async () => {
    await assertEditor(projectId);
    const pr = await db.query.property.findFirst({ where: eq(property.projectId, projectId) });
    if (!pr) return { ok: false, error: "No property" };
    const res = await getMarketTrend(pr.postalCode, segmentFor(pr.buildingType), { refresh: true });
    revalidatePath(`/app/projects/${projectId}/comparables`);
    return { ok: true, data: { error: res.error } };
  });
}

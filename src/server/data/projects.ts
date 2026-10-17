import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  comparableSale,
  manualRisk,
  organization,
  plannedMaintenance,
  project,
} from "@/db/schema";
import { taxRatesFromConfig } from "@/lib/config/resolve";
import { analyzeDeal, analyzeScenario, type DealInputs, type ScenarioInputs, type TaxRates } from "@/lib/finance/deal-engine";
import { computeRiskFlags } from "@/lib/risk/risk-rules";
import { getEffectiveConfig } from "./config";

/*
 * Data loaders. Callers MUST authorize first (src/server/authz.ts) and pass the
 * organization id / project id obtained from that check.
 */

export async function listProjects(orgId: string) {
  return db.query.project.findMany({
    where: and(eq(project.organizationId, orgId), isNull(project.archivedAt)),
    orderBy: [desc(project.updatedAt)],
    with: { property: true, deal: { with: { scenarios: true } } },
  });
}

export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

export async function getProjectBundle(projectId: string) {
  const p = await db.query.project.findFirst({
    where: eq(project.id, projectId),
    with: {
      property: true,
      housingCompany: { with: { maintenance: { orderBy: [asc(plannedMaintenance.plannedYear)] } } },
      deal: { with: { scenarios: true } },
      manualRisks: { orderBy: [desc(manualRisk.createdAt)] },
    },
  });
  if (!p) return null;
  const org = await db.query.organization.findFirst({ where: eq(organization.id, p.organizationId) });
  return { ...p, org: org! };
}

export type ProjectBundle = NonNullable<Awaited<ReturnType<typeof getProjectBundle>>>;

export function dealInputsFrom(bundle: {
  property: ProjectBundle["property"] | null | undefined;
  deal: Omit<DealWithScenarios, "scenarios"> | null | undefined;
  org: { vatDeductible: boolean };
}): DealInputs | null {
  const { property: pr, deal: d, org } = bundle;
  if (!pr || !d) return null;
  return {
    ownershipForm: pr.ownershipForm,
    livingAreaM2: pr.livingAreaM2,
    askingPrice: d.askingPrice,
    offerPrice: d.offerPrice,
    debtShare: d.debtShare,
    maintenanceFeeMonthly: d.maintenanceFeeMonthly,
    financingFeeMonthly: d.financingFeeMonthly,
    utilitiesMonthly: d.utilitiesMonthly,
    otherAcquisitionCosts: d.otherAcquisitionCosts,
    otherSellingCosts: d.otherSellingCosts,
    agentFeeBps: d.agentFeeBps,
    loanToValueBps: d.loanToValueBps,
    loanArrangementFee: d.loanArrangementFee,
    taxProfile: d.taxProfile,
    vatDeductible: org.vatDeductible,
  };
}

export function scenarioInputsFrom(deal: Pick<DealWithScenarios, "scenarios">): ScenarioInputs[] {
  return deal.scenarios.map((s) => ({
    kind: s.kind,
    salePriceDebtFree: s.salePriceDebtFree,
    renovationBudget: s.renovationBudget,
    contingencyBps: s.contingencyBps,
    holdingMonths: Number(s.holdingMonths),
    interestRateBps: s.interestRateBps,
  }));
}

/** Run the engine + risk rules for a project, using the org's effective config. */
export async function analyzeProject(bundle: ProjectBundle) {
  const config = await getEffectiveConfig(bundle.organizationId);
  const rates = taxRatesFromConfig(config);
  const inputs = dealInputsFrom(bundle);
  const results = inputs && bundle.deal ? analyzeDeal(inputs, scenarioInputsFrom(bundle.deal), rates) : [];

  const actual = inputs && bundle.deal ? computeActual(inputs, bundle.deal, rates) : null;
  const d = bundle.deal;

  const risks = bundle.property
    ? computeRiskFlags({
        today: new Date(),
        property: {
          buildYear: bundle.property.buildYear,
          ownershipForm: bundle.property.ownershipForm,
          livingAreaM2: bundle.property.livingAreaM2,
          plotType: bundle.property.plotType,
        },
        housingCompany: bundle.housingCompany,
        maintenance: bundle.housingCompany?.maintenance ?? [],
        deal: d && inputs ? { debtShare: d.debtShare, purchasePrice: d.offerPrice ?? d.askingPrice, taxProfile: d.taxProfile } : null,
        results,
        config,
      })
    : [];

  return { config, rates, inputs, results, actual, risks };
}

type DealWithScenarios = NonNullable<ProjectBundle["deal"]>;

/** Actual outcome (sold projects) runs through the same engine with actual figures. */
export function computeActual(inputs: DealInputs, d: DealWithScenarios, rates: TaxRates) {
  const expected = d.scenarios.find((s) => s.kind === "expected");
  if (!expected || !d.actualSalePrice || !d.actualHoldingMonths) return null;
  return analyzeScenario(
    { ...inputs, offerPrice: d.actualPurchasePrice ?? inputs.offerPrice },
    {
      kind: "expected",
      salePriceDebtFree: d.actualSalePrice,
      renovationBudget: d.actualRenovationCost ?? expected.renovationBudget,
      contingencyBps: 0,
      holdingMonths: Number(d.actualHoldingMonths),
      interestRateBps: expected.interestRateBps,
    },
    rates,
  );
}

/** Lightweight analysis for list views (dashboard, pipeline). */
export function analyzeListItem(item: ProjectListItem, org: { vatDeductible: boolean }, rates: TaxRates) {
  const inputs = dealInputsFrom({ property: item.property, deal: item.deal, org });
  if (!inputs || !item.deal) return { expected: null, actual: null };
  const expectedInput = scenarioInputsFrom(item.deal).find((s) => s.kind === "expected");
  return {
    expected: expectedInput ? analyzeScenario(inputs, expectedInput, rates) : null,
    actual: computeActual(inputs, item.deal, rates),
  };
}

export async function listComparables(orgId: string, projectId: string) {
  return db.query.comparableSale.findMany({
    where: and(eq(comparableSale.organizationId, orgId), eq(comparableSale.projectId, projectId)),
    orderBy: [desc(comparableSale.saleDate)],
  });
}

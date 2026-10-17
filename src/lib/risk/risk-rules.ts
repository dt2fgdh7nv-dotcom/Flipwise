/**
 * Finnish-specific risk flags. Pure functions; text is rendered via i18n (messages/*.json → risks.*).
 * Each flag carries the basis it was derived from so the UI can show source and date.
 */
import type { ResolvedConfig } from "@/lib/config/resolve";
import type { OwnershipForm, ScenarioResult, TaxProfile } from "@/lib/finance/deal-engine";

export type RiskSeverity = "info" | "medium" | "high";

export type MaintenanceKind =
  | "pipe_renovation"
  | "facade"
  | "roof"
  | "windows"
  | "balconies"
  | "elevator"
  | "electrical"
  | "drainage"
  | "yard"
  | "other";

export type RiskCode =
  | "asbestos_survey"
  | "pts_major_upcoming"
  | "pts_upcoming"
  | "pipe_renovation_overdue"
  | "renovation_notice_required"
  | "missing_manager_certificate"
  | "missing_maintenance_plan"
  | "high_debt_share"
  | "leased_plot"
  | "individual_business_income"
  | "expected_loss"
  | "worst_case_loss";

export interface RiskFlag {
  code: RiskCode;
  severity: RiskSeverity;
  params: Record<string, string | number>;
  basis: { label: string; url?: string | null; date?: string | null };
}

export interface RiskInput {
  today: Date;
  property: {
    buildYear: number;
    ownershipForm: OwnershipForm;
    livingAreaM2: number;
    plotType: "owned" | "leased" | "unknown";
  };
  housingCompany?: {
    lastPipeRenovationYear: number | null;
    managerCertificateDate: string | null;
    maintenancePlanDate: string | null;
  } | null;
  maintenance: {
    kind: MaintenanceKind;
    plannedYear: number;
    status: "planned" | "decided" | "in_progress" | "done";
    estCostPerM2: number | null;
    source: string;
  }[];
  deal?: { debtShare: number; purchasePrice: number; taxProfile: TaxProfile } | null;
  results?: ScenarioResult[];
  config: ResolvedConfig;
}

const MAJOR: MaintenanceKind[] = ["pipe_renovation", "facade", "roof"];
const LAW_HOUSING_COMPANIES = {
  label: "Limited Liability Housing Companies Act 1599/2009, ch. 5",
  url: "https://www.finlex.fi/en/laki/kaannokset/2009/en20091599",
};
const FLIPWISE_RULE = { label: "FlipWise rule (verify with your advisor)" };

const configBasis = (c: ResolvedConfig[keyof ResolvedConfig]) => ({
  label: c.source,
  url: c.sourceUrl,
  date: c.validFrom,
});

export function computeRiskFlags(input: RiskInput): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const { property, config } = input;
  const year = input.today.getFullYear();
  const isShare = property.ownershipForm === "housing_company_share";

  // Asbestos survey (asbestikartoitus) before renovation in older buildings.
  const asbestos = config["risk.asbestos_survey_before_year"];
  if (property.buildYear < asbestos.value) {
    flags.push({
      code: "asbestos_survey",
      severity: "medium",
      params: { buildYear: property.buildYear, threshold: asbestos.value },
      basis: configBasis(asbestos),
    });
  }

  // Upcoming works from the long-term maintenance plan (PTS).
  const horizon = config["risk.pts_horizon_years"];
  const expected = input.results?.find((r) => r.kind === "expected");
  const saleYear = expected
    ? new Date(input.today.getTime() + expected.holding.months * 30.4 * 86_400_000).getFullYear()
    : year;
  for (const m of input.maintenance) {
    if (m.status === "done") continue;
    if (m.plannedYear < year || m.plannedYear > year + horizon.value) continue;
    const share = m.estCostPerM2 ? Math.round(m.estCostPerM2 * property.livingAreaM2) : null;
    flags.push({
      code: MAJOR.includes(m.kind) ? "pts_major_upcoming" : "pts_upcoming",
      severity: MAJOR.includes(m.kind) ? "high" : "medium",
      params: {
        kind: m.kind,
        year: m.plannedYear,
        status: m.status,
        estimatedShare: share ?? "",
        beforeSale: m.plannedYear <= saleYear ? "yes" : "no",
      },
      basis: { label: m.source },
    });
  }

  // Original plumbing past typical service life with no pipe renovation on record or planned.
  const pipeAge = config["risk.pipe_renovation_age_years"];
  const pipePlanned = input.maintenance.some((m) => m.kind === "pipe_renovation");
  const lastPipe = input.housingCompany?.lastPipeRenovationYear ?? null;
  const pipeReference = lastPipe ?? property.buildYear;
  if (isShare && !pipePlanned && year - pipeReference >= pipeAge.value) {
    flags.push({
      code: "pipe_renovation_overdue",
      severity: "high",
      params: { referenceYear: pipeReference, age: year - pipeReference, renovated: lastPipe ? "yes" : "no" },
      basis: configBasis(pipeAge),
    });
  }

  if (isShare) {
    flags.push({ code: "renovation_notice_required", severity: "info", params: {}, basis: LAW_HOUSING_COMPANIES });
    if (!input.housingCompany?.managerCertificateDate) {
      flags.push({ code: "missing_manager_certificate", severity: "medium", params: {}, basis: FLIPWISE_RULE });
    }
    if (!input.housingCompany?.maintenancePlanDate) {
      flags.push({ code: "missing_maintenance_plan", severity: "medium", params: {}, basis: FLIPWISE_RULE });
    }
  }

  if (input.deal && isShare) {
    const debtFree = input.deal.purchasePrice + input.deal.debtShare;
    const ratioBps = debtFree > 0 ? Math.round((input.deal.debtShare / debtFree) * 10_000) : 0;
    const limit = config["risk.high_debt_share_ratio"];
    if (ratioBps > limit.value) {
      flags.push({
        code: "high_debt_share",
        severity: "medium",
        params: { ratioBps, limitBps: limit.value },
        basis: configBasis(limit),
      });
    }
  }

  if (property.plotType === "leased") {
    flags.push({ code: "leased_plot", severity: "info", params: {}, basis: FLIPWISE_RULE });
  }

  if (input.deal?.taxProfile === "individual") {
    flags.push({
      code: "individual_business_income",
      severity: "medium",
      params: {},
      basis: { label: "Vero.fi — Sale of property", url: config["tax.capital_income.lower"].sourceUrl },
    });
  }

  if (expected && expected.profitAfterTax < 0) {
    flags.push({ code: "expected_loss", severity: "high", params: { amount: expected.profitAfterTax }, basis: FLIPWISE_RULE });
  } else {
    const worst = input.results?.find((r) => r.kind === "worst");
    if (worst && worst.profitAfterTax < 0) {
      flags.push({ code: "worst_case_loss", severity: "medium", params: { amount: worst.profitAfterTax }, basis: FLIPWISE_RULE });
    }
  }

  const order: Record<RiskSeverity, number> = { high: 0, medium: 1, info: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

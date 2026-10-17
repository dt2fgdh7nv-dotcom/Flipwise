import { describe, expect, it } from "vitest";
import { resolveConfig } from "@/lib/config/resolve";
import { resolveSeedConfig, seedConfigRows } from "@/lib/config/defaults";
import { computeRiskFlags, type RiskInput } from "./risk-rules";

const config = resolveSeedConfig();
const base: RiskInput = {
  today: new Date("2026-10-17"),
  property: { buildYear: 1975, ownershipForm: "housing_company_share", livingAreaM2: 60, plotType: "owned" },
  housingCompany: { lastPipeRenovationYear: null, managerCertificateDate: "2026-09-01", maintenancePlanDate: "2026-01-01" },
  maintenance: [],
  deal: { debtShare: 0, purchasePrice: 20_000_000, taxProfile: "company" },
  config,
};
const codes = (i: RiskInput) => computeRiskFlags(i).map((f) => f.code);

describe("computeRiskFlags", () => {
  it("flags asbestos survey for pre-1994 buildings only", () => {
    expect(codes(base)).toContain("asbestos_survey");
    expect(codes({ ...base, property: { ...base.property, buildYear: 2001 } })).not.toContain("asbestos_survey");
  });

  it("flags overdue pipe renovation when none is recorded or planned", () => {
    expect(codes(base)).toContain("pipe_renovation_overdue");
    const withPlan: RiskInput = {
      ...base,
      maintenance: [{ kind: "pipe_renovation", plannedYear: 2029, status: "planned", estCostPerM2: 90_000, source: "PTS 2026" }],
    };
    expect(codes(withPlan)).not.toContain("pipe_renovation_overdue");
    expect(codes(withPlan)).toContain("pts_major_upcoming");
    const flag = computeRiskFlags(withPlan).find((f) => f.code === "pts_major_upcoming")!;
    expect(flag.severity).toBe("high");
    expect(flag.params.estimatedShare).toBe(5_400_000); // 900 €/m² * 60 m²
    expect(flag.basis.label).toBe("PTS 2026");
  });

  it("ignores PTS items outside the horizon or done", () => {
    const i: RiskInput = {
      ...base,
      housingCompany: { ...base.housingCompany!, lastPipeRenovationYear: 2015 },
      maintenance: [
        { kind: "roof", plannedYear: 2040, status: "planned", estCostPerM2: null, source: "PTS" },
        { kind: "facade", plannedYear: 2027, status: "done", estCostPerM2: null, source: "PTS" },
      ],
    };
    expect(codes(i)).not.toContain("pts_major_upcoming");
  });

  it("applies org overrides from config", () => {
    const rows = seedConfigRows();
    rows.push({ ...rows.find((r) => r.key === "risk.asbestos_survey_before_year")!, id: "o", organizationId: "org1", value: 1970 });
    const overridden = resolveConfig(rows, "2026-10-17");
    expect(overridden["risk.asbestos_survey_before_year"].scope).toBe("organization");
    expect(codes({ ...base, config: overridden })).not.toContain("asbestos_survey");
  });

  it("flags missing documents, debt share and individual tax profile", () => {
    const i: RiskInput = {
      ...base,
      housingCompany: { lastPipeRenovationYear: 2010, managerCertificateDate: null, maintenancePlanDate: null },
      deal: { debtShare: 10_000_000, purchasePrice: 15_000_000, taxProfile: "individual" },
    };
    const c = codes(i);
    expect(c).toEqual(expect.arrayContaining(["missing_manager_certificate", "missing_maintenance_plan", "high_debt_share", "individual_business_income"]));
  });

  it("does not apply housing-company rules to real estate", () => {
    const c = codes({ ...base, property: { ...base.property, ownershipForm: "real_estate" } });
    expect(c).not.toContain("renovation_notice_required");
    expect(c).not.toContain("pipe_renovation_overdue");
  });
});

import { describe, expect, it } from "vitest";
import {
  analyzeDeal,
  analyzeScenario,
  capitalIncomeTax,
  deriveScenarios,
  type DealInputs,
  type ScenarioInputs,
  type TaxRates,
} from "./deal-engine";

const eur = (v: number) => Math.round(v * 100);

const rates: TaxRates = {
  transferTaxHousingShareBps: 150,
  transferTaxRealEstateBps: 300,
  corporateTaxBps: 2000,
  capitalIncomeLowerBps: 3000,
  capitalIncomeUpperBps: 3400,
  capitalIncomeThreshold: eur(30_000),
  acquisitionCostPresumptionBps: 2000,
  vatBps: 2550,
};

const deal: DealInputs = {
  ownershipForm: "housing_company_share",
  livingAreaM2: 50,
  askingPrice: eur(200_000),
  offerPrice: null,
  debtShare: eur(10_000),
  maintenanceFeeMonthly: eur(250),
  financingFeeMonthly: eur(50),
  utilitiesMonthly: eur(60),
  otherAcquisitionCosts: eur(500),
  otherSellingCosts: eur(1_000),
  agentFeeBps: 300,
  loanToValueBps: 5000,
  loanArrangementFee: eur(1_000),
  taxProfile: "company",
  vatDeductible: false,
};

const expected: ScenarioInputs = {
  kind: "expected",
  salePriceDebtFree: eur(280_000),
  renovationBudget: eur(30_000),
  contingencyBps: 1000,
  holdingMonths: 6,
  interestRateBps: 600,
};

describe("analyzeScenario", () => {
  const r = analyzeScenario(deal, expected, rates);

  it("computes acquisition with transfer tax on the debt-free price for housing shares", () => {
    expect(r.acquisition.debtFreePurchasePrice).toBe(eur(210_000));
    expect(r.acquisition.transferTax).toBe(eur(3_150)); // 1.5 % of 210 000
    expect(r.acquisition.total).toBe(eur(210_000 + 3_150 + 500));
  });

  it("adds contingency and non-deductible VAT to renovation", () => {
    expect(r.renovation.contingency).toBe(eur(3_000));
    expect(r.renovation.vat).toBe(eur(33_000 * 0.255)); // 8 415
    expect(r.renovation.total).toBe(eur(41_415));
  });

  it("computes holding costs incl. interest-only loan", () => {
    expect(r.loanAmount).toBe(eur(100_000));
    expect(r.holding.maintenanceFees).toBe(eur(1_500));
    expect(r.holding.financingFees).toBe(eur(300));
    expect(r.holding.utilities).toBe(eur(360));
    expect(r.holding.loanInterest).toBe(eur(3_000)); // 100k * 6 % * 6/12
    expect(r.holding.total).toBe(eur(1_500 + 300 + 360 + 3_000 + 1_000));
  });

  it("computes selling costs with agent VAT", () => {
    expect(r.selling.agentFee).toBe(eur(8_400));
    expect(r.selling.agentFeeVat).toBe(eur(2_142));
    expect(r.selling.total).toBe(eur(8_400 + 2_142 + 1_000));
  });

  it("computes profit, corporate tax and returns", () => {
    const totalCost = 213_650 + 41_415 + 6_160 + 11_542;
    expect(r.totalCost).toBe(eur(totalCost));
    expect(r.profitBeforeTax).toBe(eur(280_000 - totalCost));
    expect(r.tax).toBe(Math.round(r.profitBeforeTax * 0.2));
    expect(r.profitAfterTax).toBe(r.profitBeforeTax - r.tax);
    expect(r.roi).toBeCloseTo(r.profitAfterTax / r.totalCost, 10);
    expect(r.annualizedRoi).toBeCloseTo(Math.pow(1 + r.roi, 2) - 1, 10);
    expect(r.equityRequired).toBe(eur(200_000 + 3_150 + 500 + 41_415 + 6_160 - 100_000));
  });

  it("break-even sale price yields ~zero profit before tax", () => {
    const atBreakEven = analyzeScenario(deal, { ...expected, salePriceDebtFree: r.breakEvenSalePrice }, rates);
    expect(Math.abs(atBreakEven.profitBeforeTax)).toBeLessThanOrEqual(2);
  });

  it("reports per-m² figures", () => {
    expect(r.perM2.purchaseDebtFree).toBe(eur(4_200));
    expect(r.perM2.sale).toBe(eur(5_600));
  });
});

describe("ownership and VAT variants", () => {
  it("uses 3 % transfer tax and ignores debt share for real estate", () => {
    const r = analyzeScenario({ ...deal, ownershipForm: "real_estate" }, expected, rates);
    expect(r.acquisition.debtShare).toBe(0);
    expect(r.acquisition.transferTax).toBe(eur(6_000));
    expect(r.holding.financingFees).toBe(0);
    expect(r.assumptions).toContain("real_estate_no_debt_share");
  });

  it("skips VAT when deductible", () => {
    const r = analyzeScenario({ ...deal, vatDeductible: true }, expected, rates);
    expect(r.renovation.vat).toBe(0);
    expect(r.selling.agentFeeVat).toBe(0);
  });

  it("uses offer price when given", () => {
    const r = analyzeScenario({ ...deal, offerPrice: eur(190_000) }, expected, rates);
    expect(r.acquisition.purchasePrice).toBe(eur(190_000));
  });

  it("no corporate tax on a loss", () => {
    const r = analyzeScenario(deal, { ...expected, salePriceDebtFree: eur(200_000) }, rates);
    expect(r.profitBeforeTax).toBeLessThan(0);
    expect(r.tax).toBe(0);
    expect(r.assumptions).toContain("company_losses_not_carried");
  });
});

describe("individual tax profile", () => {
  it("applies progressive capital income tax", () => {
    expect(capitalIncomeTax(eur(10_000), rates)).toBe(eur(3_000));
    expect(capitalIncomeTax(eur(40_000), rates)).toBe(eur(9_000 + 3_400));
    expect(capitalIncomeTax(-5, rates)).toBe(0);
  });

  it("excludes holding costs from deductible costs", () => {
    const r = analyzeScenario({ ...deal, taxProfile: "individual" }, expected, rates);
    const deductible = r.acquisition.total + r.renovation.total + r.selling.total;
    expect(r.taxableGain).toBe(expected.salePriceDebtFree - deductible);
    expect(r.taxableGain).toBeGreaterThan(r.profitBeforeTax);
    expect(r.tax).toBe(capitalIncomeTax(r.taxableGain, rates));
  });
});

describe("analyzeDeal / deriveScenarios", () => {
  it("derives ordered scenarios with worst <= expected <= best profit", () => {
    const results = analyzeDeal(deal, deriveScenarios(expected), rates);
    expect(results.map((r) => r.kind)).toEqual(["worst", "expected", "best"]);
    expect(results[0].profitAfterTax).toBeLessThan(results[1].profitAfterTax);
    expect(results[1].profitAfterTax).toBeLessThan(results[2].profitAfterTax);
  });
});

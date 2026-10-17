/**
 * FlipWise deal engine — pure, deterministic, shared by server and client.
 *
 * All money values are integer euro cents. All rates are basis points (bps, 1 % = 100).
 * The engine never reads config itself: callers pass rates in, so every number on screen
 * can be traced back to an editable, sourced config value.
 */

export type OwnershipForm = "housing_company_share" | "real_estate";
export type TaxProfile = "company" | "individual";
export type ScenarioKind = "best" | "expected" | "worst";

export interface TaxRates {
  transferTaxHousingShareBps: number;
  transferTaxRealEstateBps: number;
  corporateTaxBps: number;
  capitalIncomeLowerBps: number;
  capitalIncomeUpperBps: number;
  /** Capital income above this (cents) is taxed at the upper rate. */
  capitalIncomeThreshold: number;
  /** Hankintameno-olettama: minimum deductible share of sale price for individuals. */
  acquisitionCostPresumptionBps: number;
  vatBps: number;
}

export interface DealInputs {
  ownershipForm: OwnershipForm;
  livingAreaM2?: number | null;
  /** Myyntihinta: price paid to the seller, excluding the housing company debt share. */
  askingPrice: number;
  offerPrice?: number | null;
  /** Velkaosuus: share of housing company debt carried by the apartment (shares only). */
  debtShare: number;
  /** Hoitovastike per month. */
  maintenanceFeeMonthly: number;
  /** Rahoitusvastike per month. */
  financingFeeMonthly: number;
  utilitiesMonthly: number;
  /** Paid as invoiced (inspection, legal, bank fees). */
  otherAcquisitionCosts: number;
  /** Paid as invoiced (styling, photos, marketing). */
  otherSellingCosts: number;
  /** Agent commission on the debt-free sale price, excluding VAT. */
  agentFeeBps: number;
  /** Share of the purchase price financed with a loan. */
  loanToValueBps: number;
  loanArrangementFee: number;
  taxProfile: TaxProfile;
  /** Can the owner deduct input VAT? Usually false: selling housing shares is VAT-exempt. */
  vatDeductible: boolean;
}

export interface ScenarioInputs {
  kind: ScenarioKind;
  /** Velaton myyntihinta — expected debt-free sale price. */
  salePriceDebtFree: number;
  /** Renovation budget excluding VAT. */
  renovationBudget: number;
  contingencyBps: number;
  holdingMonths: number;
  /** Annual loan interest. */
  interestRateBps: number;
}

export interface ScenarioResult {
  kind: ScenarioKind;
  acquisition: {
    purchasePrice: number;
    debtShare: number;
    debtFreePurchasePrice: number;
    transferTaxRateBps: number;
    transferTaxBase: number;
    transferTax: number;
    otherCosts: number;
    total: number;
  };
  renovation: {
    budgetExclVat: number;
    contingency: number;
    vat: number;
    total: number;
  };
  holding: {
    months: number;
    maintenanceFees: number;
    financingFees: number;
    utilities: number;
    loanInterest: number;
    loanArrangementFee: number;
    total: number;
  };
  selling: {
    salePriceDebtFree: number;
    agentFee: number;
    agentFeeVat: number;
    otherCosts: number;
    total: number;
  };
  loanAmount: number;
  /** Debt-free view: acquisition (incl. debt share) + renovation + holding + selling. */
  totalCost: number;
  /** Cash the owner must put in before sale (debt share is assumed, not paid). */
  equityRequired: number;
  profitBeforeTax: number;
  taxableGain: number;
  tax: number;
  profitAfterTax: number;
  /** Profit after tax / total cost. */
  roi: number;
  /** Profit after tax / equity required. */
  returnOnEquity: number;
  /** ROI compounded to a 12-month period. */
  annualizedRoi: number;
  /** Debt-free sale price where profit before tax is zero. */
  breakEvenSalePrice: number;
  perM2: {
    purchaseDebtFree: number | null;
    sale: number | null;
    breakEven: number | null;
  };
  /** Machine-readable assumption codes, rendered via i18n. */
  assumptions: AssumptionCode[];
}

export type AssumptionCode =
  | "debt_share_unchanged_at_sale"
  | "interest_only_loan"
  | "vat_not_deductible"
  | "vat_deductible"
  | "individual_holding_costs_not_deductible"
  | "individual_presumption_applied"
  | "company_losses_not_carried"
  | "real_estate_no_debt_share";

const applyBps = (amount: number, bps: number) => Math.round((amount * bps) / 10_000);

export function transferTaxRate(ownership: OwnershipForm, rates: TaxRates) {
  return ownership === "housing_company_share"
    ? rates.transferTaxHousingShareBps
    : rates.transferTaxRealEstateBps;
}

/** Progressive Finnish capital income tax (individuals). */
export function capitalIncomeTax(gain: number, rates: TaxRates) {
  if (gain <= 0) return 0;
  const lowerPart = Math.min(gain, rates.capitalIncomeThreshold);
  const upperPart = Math.max(0, gain - rates.capitalIncomeThreshold);
  return applyBps(lowerPart, rates.capitalIncomeLowerBps) + applyBps(upperPart, rates.capitalIncomeUpperBps);
}

export function analyzeScenario(
  deal: DealInputs,
  scenario: ScenarioInputs,
  rates: TaxRates,
): ScenarioResult {
  const assumptions: AssumptionCode[] = [];
  const isShare = deal.ownershipForm === "housing_company_share";
  const months = Math.max(0, scenario.holdingMonths);

  // --- Acquisition -------------------------------------------------------
  const purchasePrice = deal.offerPrice ?? deal.askingPrice;
  const debtShare = isShare ? deal.debtShare : 0;
  if (!isShare && deal.debtShare > 0) assumptions.push("real_estate_no_debt_share");
  const debtFreePurchasePrice = purchasePrice + debtShare;
  const transferTaxRateBps = transferTaxRate(deal.ownershipForm, rates);
  // For housing shares the debt share assumed by the buyer is part of the transfer tax base.
  const transferTaxBase = debtFreePurchasePrice;
  const transferTax = applyBps(transferTaxBase, transferTaxRateBps);
  const acquisitionTotal = debtFreePurchasePrice + transferTax + deal.otherAcquisitionCosts;

  // --- Renovation --------------------------------------------------------
  const contingency = applyBps(scenario.renovationBudget, scenario.contingencyBps);
  const renovationNet = scenario.renovationBudget + contingency;
  const renovationVat = deal.vatDeductible ? 0 : applyBps(renovationNet, rates.vatBps);
  assumptions.push(deal.vatDeductible ? "vat_deductible" : "vat_not_deductible");
  const renovationTotal = renovationNet + renovationVat;

  // --- Holding -----------------------------------------------------------
  const loanAmount = applyBps(purchasePrice, deal.loanToValueBps);
  const maintenanceFees = Math.round(deal.maintenanceFeeMonthly * months);
  const financingFees = isShare ? Math.round(deal.financingFeeMonthly * months) : 0;
  const utilities = Math.round(deal.utilitiesMonthly * months);
  const loanInterest = Math.round((loanAmount * scenario.interestRateBps * months) / (10_000 * 12));
  const loanArrangementFee = loanAmount > 0 ? deal.loanArrangementFee : 0;
  if (loanAmount > 0) assumptions.push("interest_only_loan");
  const holdingTotal = maintenanceFees + financingFees + utilities + loanInterest + loanArrangementFee;

  // --- Selling -----------------------------------------------------------
  const sale = scenario.salePriceDebtFree;
  const agentFee = applyBps(sale, deal.agentFeeBps);
  const agentFeeVat = deal.vatDeductible ? 0 : applyBps(agentFee, rates.vatBps);
  const sellingTotal = agentFee + agentFeeVat + deal.otherSellingCosts;
  if (isShare && debtShare > 0) assumptions.push("debt_share_unchanged_at_sale");

  // --- Profit ------------------------------------------------------------
  const totalCost = acquisitionTotal + renovationTotal + holdingTotal + sellingTotal;
  const profitBeforeTax = sale - totalCost;

  let taxableGain: number;
  let tax: number;
  if (deal.taxProfile === "company") {
    taxableGain = profitBeforeTax;
    tax = taxableGain > 0 ? applyBps(taxableGain, rates.corporateTaxBps) : 0;
    if (taxableGain < 0) assumptions.push("company_losses_not_carried");
  } else {
    // Individuals: capital gain. Holding costs are treated as non-deductible (conservative).
    const deductible = acquisitionTotal + renovationTotal + sellingTotal;
    const presumption = applyBps(sale, rates.acquisitionCostPresumptionBps);
    if (presumption > deductible) assumptions.push("individual_presumption_applied");
    taxableGain = sale - Math.max(deductible, presumption);
    tax = capitalIncomeTax(taxableGain, rates);
    assumptions.push("individual_holding_costs_not_deductible");
  }
  const profitAfterTax = profitBeforeTax - tax;

  // Cash in before sale. Debt share is assumed (paid via rahoitusvastike), not paid upfront.
  const equityRequired =
    purchasePrice + transferTax + deal.otherAcquisitionCosts + renovationTotal + holdingTotal - loanAmount;

  const roi = totalCost > 0 ? profitAfterTax / totalCost : 0;
  const returnOnEquity = equityRequired > 0 ? profitAfterTax / equityRequired : 0;
  const annualizedRoi = months > 0 && roi > -1 ? Math.pow(1 + roi, 12 / months) - 1 : roi;

  // Break-even: S - fixed - S * effectiveAgentRate = 0
  const effectiveAgentRate =
    (deal.agentFeeBps / 10_000) * (deal.vatDeductible ? 1 : 1 + rates.vatBps / 10_000);
  const fixedCosts = totalCost - agentFee - agentFeeVat;
  const breakEvenSalePrice = Math.ceil(fixedCosts / (1 - effectiveAgentRate));

  const area = deal.livingAreaM2 && deal.livingAreaM2 > 0 ? deal.livingAreaM2 : null;
  const perM2 = (v: number) => (area ? Math.round(v / area) : null);

  return {
    kind: scenario.kind,
    acquisition: {
      purchasePrice,
      debtShare,
      debtFreePurchasePrice,
      transferTaxRateBps,
      transferTaxBase,
      transferTax,
      otherCosts: deal.otherAcquisitionCosts,
      total: acquisitionTotal,
    },
    renovation: {
      budgetExclVat: scenario.renovationBudget,
      contingency,
      vat: renovationVat,
      total: renovationTotal,
    },
    holding: {
      months,
      maintenanceFees,
      financingFees,
      utilities,
      loanInterest,
      loanArrangementFee,
      total: holdingTotal,
    },
    selling: {
      salePriceDebtFree: sale,
      agentFee,
      agentFeeVat,
      otherCosts: deal.otherSellingCosts,
      total: sellingTotal,
    },
    loanAmount,
    totalCost,
    equityRequired,
    profitBeforeTax,
    taxableGain,
    tax,
    profitAfterTax,
    roi,
    returnOnEquity,
    annualizedRoi,
    breakEvenSalePrice,
    perM2: {
      purchaseDebtFree: perM2(debtFreePurchasePrice),
      sale: perM2(sale),
      breakEven: perM2(breakEvenSalePrice),
    },
    assumptions: [...new Set(assumptions)],
  };
}

export function analyzeDeal(deal: DealInputs, scenarios: ScenarioInputs[], rates: TaxRates) {
  const order: ScenarioKind[] = ["worst", "expected", "best"];
  return [...scenarios]
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((s) => analyzeScenario(deal, s, rates));
}

/** Derive best/worst cases from the expected case with transparent, editable deltas. */
export function deriveScenarios(expected: Omit<ScenarioInputs, "kind">): ScenarioInputs[] {
  const roundTo = (v: number, step: number) => Math.round(v / step) * step;
  return [
    {
      kind: "best",
      salePriceDebtFree: roundTo(expected.salePriceDebtFree * 1.05, 100_000),
      renovationBudget: roundTo(expected.renovationBudget * 0.95, 10_000),
      contingencyBps: 500,
      holdingMonths: Math.max(1, expected.holdingMonths - 1),
      interestRateBps: Math.max(0, expected.interestRateBps - 50),
    },
    { kind: "expected", ...expected },
    {
      kind: "worst",
      salePriceDebtFree: roundTo(expected.salePriceDebtFree * 0.92, 100_000),
      renovationBudget: roundTo(expected.renovationBudget * 1.25, 10_000),
      contingencyBps: 1500,
      holdingMonths: expected.holdingMonths + 3,
      interestRateBps: expected.interestRateBps + 100,
    },
  ];
}

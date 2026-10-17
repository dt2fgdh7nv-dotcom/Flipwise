import type { TaxRates } from "@/lib/finance/deal-engine";
import { CONFIG_KEYS, type ConfigKey, type ConfigUnit } from "./definitions";

export interface ConfigRow {
  id: string;
  organizationId: string | null;
  key: string;
  value: number;
  unit: string;
  validFrom: string;
  source: string;
  sourceUrl: string | null;
  notes: string | null;
  updatedAt: Date;
}

export interface ResolvedConfigValue {
  key: ConfigKey;
  value: number;
  unit: ConfigUnit;
  validFrom: string;
  source: string;
  sourceUrl: string | null;
  notes: string | null;
  scope: "platform" | "organization";
  rowId: string;
  updatedAt: Date;
}

export type ResolvedConfig = Record<ConfigKey, ResolvedConfigValue>;

/**
 * Pick the effective value per key: an org override beats the platform default;
 * within a scope the latest valid_from that is not in the future wins.
 */
export function resolveConfig(rows: ConfigRow[], today: string): ResolvedConfig {
  const out: Partial<ResolvedConfig> = {};
  for (const key of CONFIG_KEYS) {
    const candidates = rows
      .filter((r) => r.key === key && r.validFrom <= today)
      .sort((a, b) => {
        const scopeA = a.organizationId ? 1 : 0;
        const scopeB = b.organizationId ? 1 : 0;
        if (scopeA !== scopeB) return scopeB - scopeA;
        return b.validFrom.localeCompare(a.validFrom);
      });
    const r = candidates[0];
    if (!r) throw new Error(`Missing config value for ${key}. Run the seed script.`);
    out[key] = {
      key,
      value: Number(r.value),
      unit: r.unit as ConfigUnit,
      validFrom: r.validFrom,
      source: r.source,
      sourceUrl: r.sourceUrl,
      notes: r.notes,
      scope: r.organizationId ? "organization" : "platform",
      rowId: r.id,
      updatedAt: r.updatedAt,
    };
  }
  return out as ResolvedConfig;
}

export function taxRatesFromConfig(c: ResolvedConfig): TaxRates {
  return {
    transferTaxHousingShareBps: c["tax.transfer.housing_share"].value,
    transferTaxRealEstateBps: c["tax.transfer.real_estate"].value,
    corporateTaxBps: c["tax.corporate"].value,
    capitalIncomeLowerBps: c["tax.capital_income.lower"].value,
    capitalIncomeUpperBps: c["tax.capital_income.upper"].value,
    capitalIncomeThreshold: c["tax.capital_income.threshold"].value,
    acquisitionCostPresumptionBps: c["tax.acquisition_cost_presumption"].value,
    vatBps: c["tax.vat.general"].value,
  };
}

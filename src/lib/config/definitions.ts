/**
 * Editable configuration keys. These are SEED defaults only — the database is the source of
 * truth (config_value table). Platform admins edit defaults; org admins can override per tenant.
 */

export type ConfigUnit = "bps" | "cents" | "year" | "years";

export interface ConfigDefinition {
  key: ConfigKey;
  group: "tax" | "deal" | "risk";
  unit: ConfigUnit;
  seed: {
    value: number;
    validFrom: string;
    source: string;
    sourceUrl?: string;
    notes?: string;
  };
}

export const CONFIG_KEYS = [
  "tax.transfer.housing_share",
  "tax.transfer.real_estate",
  "tax.corporate",
  "tax.capital_income.lower",
  "tax.capital_income.upper",
  "tax.capital_income.threshold",
  "tax.acquisition_cost_presumption",
  "tax.vat.general",
  "deal.default.agent_fee",
  "deal.default.interest_rate",
  "deal.default.loan_to_value",
  "deal.default.utilities_monthly",
  "deal.default.contingency",
  "risk.asbestos_survey_before_year",
  "risk.pts_horizon_years",
  "risk.pipe_renovation_age_years",
  "risk.high_debt_share_ratio",
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

const VERO_TRANSFER = "https://www.vero.fi/en/individuals/property/transfer-tax/";
const VERO_VAT = "https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/rates-of-vat/";
const VERO_CAPITAL = "https://www.vero.fi/en/individuals/property/sale-of-property/";
const VERO_CORP = "https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/";

export const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  {
    key: "tax.transfer.housing_share",
    group: "tax",
    unit: "bps",
    seed: {
      value: 150,
      validFrom: "2024-01-01",
      source: "Vero.fi — Transfer tax (Varainsiirtoverolaki 931/1996)",
      sourceUrl: VERO_TRANSFER,
      notes: "Housing company shares (asunto-osake). Base includes the debt share assumed by the buyer.",
    },
  },
  {
    key: "tax.transfer.real_estate",
    group: "tax",
    unit: "bps",
    seed: {
      value: 300,
      validFrom: "2024-01-01",
      source: "Vero.fi — Transfer tax (Varainsiirtoverolaki 931/1996)",
      sourceUrl: VERO_TRANSFER,
      notes: "Real estate (kiinteistö / määräala).",
    },
  },
  {
    key: "tax.corporate",
    group: "tax",
    unit: "bps",
    seed: { value: 2000, validFrom: "2014-01-01", source: "Vero.fi — Corporate income tax", sourceUrl: VERO_CORP },
  },
  {
    key: "tax.capital_income.lower",
    group: "tax",
    unit: "bps",
    seed: { value: 3000, validFrom: "2016-01-01", source: "Vero.fi — Capital income tax", sourceUrl: VERO_CAPITAL },
  },
  {
    key: "tax.capital_income.upper",
    group: "tax",
    unit: "bps",
    seed: { value: 3400, validFrom: "2016-01-01", source: "Vero.fi — Capital income tax", sourceUrl: VERO_CAPITAL },
  },
  {
    key: "tax.capital_income.threshold",
    group: "tax",
    unit: "cents",
    seed: {
      value: 3_000_000,
      validFrom: "2016-01-01",
      source: "Vero.fi — Capital income tax",
      sourceUrl: VERO_CAPITAL,
      notes: "Capital income above this amount per year is taxed at the upper rate.",
    },
  },
  {
    key: "tax.acquisition_cost_presumption",
    group: "tax",
    unit: "bps",
    seed: {
      value: 2000,
      validFrom: "2016-01-01",
      source: "Vero.fi — Deemed acquisition cost (hankintameno-olettama)",
      sourceUrl: VERO_CAPITAL,
      notes: "Individuals, property owned under 10 years.",
    },
  },
  {
    key: "tax.vat.general",
    group: "tax",
    unit: "bps",
    seed: { value: 2550, validFrom: "2024-09-01", source: "Vero.fi — VAT rates", sourceUrl: VERO_VAT },
  },
  {
    key: "deal.default.agent_fee",
    group: "deal",
    unit: "bps",
    seed: {
      value: 300,
      validFrom: "2026-01-01",
      source: "FlipWise default",
      notes: "Excl. VAT, on debt-free price. Finnish agent fees are typically quoted ~2.5–4.5 % incl. VAT; use your agreement.",
    },
  },
  {
    key: "deal.default.interest_rate",
    group: "deal",
    unit: "bps",
    seed: { value: 550, validFrom: "2026-01-01", source: "FlipWise default", notes: "Use the rate in your loan offer." },
  },
  {
    key: "deal.default.loan_to_value",
    group: "deal",
    unit: "bps",
    seed: { value: 6000, validFrom: "2026-01-01", source: "FlipWise default" },
  },
  {
    key: "deal.default.utilities_monthly",
    group: "deal",
    unit: "cents",
    seed: {
      value: 6000,
      validFrom: "2026-01-01",
      source: "FlipWise default",
      notes: "Electricity, water advance, home insurance while holding.",
    },
  },
  {
    key: "deal.default.contingency",
    group: "deal",
    unit: "bps",
    seed: { value: 1000, validFrom: "2026-01-01", source: "FlipWise default" },
  },
  {
    key: "risk.asbestos_survey_before_year",
    group: "risk",
    unit: "year",
    seed: {
      value: 1994,
      validFrom: "2016-02-01",
      source: "Government Decree on the safety of asbestos work 798/2015",
      sourceUrl: "https://www.finlex.fi/fi/laki/alkup/2015/20150798",
      notes: "Asbestos survey required before renovation work in buildings started before 1994.",
    },
  },
  {
    key: "risk.pts_horizon_years",
    group: "risk",
    unit: "years",
    seed: {
      value: 5,
      validFrom: "2026-01-01",
      source: "FlipWise default",
      notes: "Planned major works within this many years are flagged as affecting resale.",
    },
  },
  {
    key: "risk.pipe_renovation_age_years",
    group: "risk",
    unit: "years",
    seed: {
      value: 45,
      validFrom: "2026-01-01",
      source: "FlipWise default",
      notes: "Typical service life of original plumbing is roughly 40–50 years.",
    },
  },
  {
    key: "risk.high_debt_share_ratio",
    group: "risk",
    unit: "bps",
    seed: {
      value: 3000,
      validFrom: "2026-01-01",
      source: "FlipWise default",
      notes: "Debt share above this share of the debt-free price is flagged.",
    },
  },
];

export const CONFIG_DEFINITION_BY_KEY = Object.fromEntries(
  CONFIG_DEFINITIONS.map((d) => [d.key, d]),
) as Record<ConfigKey, ConfigDefinition>;

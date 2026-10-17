import { z } from "zod";

export const BUILDING_TYPES = ["apartment", "rowhouse", "semi_detached"] as const;
export const OWNERSHIP_FORMS = ["housing_company_share", "real_estate"] as const;
export const CONDITIONS = ["good", "satisfactory", "fair", "poor"] as const;
export const PLOT_TYPES = ["owned", "leased", "unknown"] as const;
export const TAX_PROFILES = ["company", "individual"] as const;
export const SCENARIO_KINDS = ["best", "expected", "worst"] as const;
export const MAINTENANCE_KINDS = ["pipe_renovation", "facade", "roof", "windows", "balconies", "elevator", "electrical", "drainage", "yard", "other"] as const;
export const MAINTENANCE_STATUSES = ["planned", "decided", "in_progress", "done"] as const;

const year = new Date().getFullYear();
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** Money in integer cents. */
export const money = z.number({ error: "Enter an amount" }).int().min(0).max(100_000_000_000);
const bps = (max: number) => z.number({ error: "Enter a percentage" }).int().min(0).max(max);

export const propertySchema = z.object({
  streetAddress: z.string().trim().min(2, "Enter the street address").max(120),
  unit: optText(20),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Postal code is 5 digits"),
  municipality: z.string().trim().min(2, "Enter the municipality").max(60),
  district: optText(60),
  buildingType: z.enum(BUILDING_TYPES),
  ownershipForm: z.enum(OWNERSHIP_FORMS),
  livingAreaM2: z.number({ error: "Enter the living area" }).positive().max(2000),
  rooms: z.number({ error: "Enter rooms" }).int().min(1).max(30),
  layout: optText(30),
  buildYear: z.number({ error: "Enter the build year" }).int().min(1700).max(year + 3),
  floor: z.number().int().min(-2).max(80).nullable(),
  floorsTotal: z.number().int().min(1).max(80).nullable(),
  hasElevator: z.boolean().nullable(),
  hasSauna: z.boolean(),
  hasBalcony: z.boolean(),
  plotType: z.enum(PLOT_TYPES),
  condition: z.enum(CONDITIONS),
  energyClass: optText(4),
});
export type PropertyInput = z.infer<typeof propertySchema>;

export const newProjectSchema = z.object({
  name: optText(120),
  property: propertySchema,
  askingPrice: money,
  debtShare: money,
  maintenanceFeeMonthly: money,
  financingFeeMonthly: money,
  expectedSalePrice: money,
  renovationBudget: money,
  holdingMonths: z.number().min(1).max(60),
});
export type NewProjectInput = z.infer<typeof newProjectSchema>;

export const scenarioSchema = z.object({
  kind: z.enum(SCENARIO_KINDS),
  salePriceDebtFree: money,
  renovationBudget: money,
  contingencyBps: bps(10_000),
  holdingMonths: z.number().min(0).max(120),
  interestRateBps: bps(3_000),
});

export const dealSchema = z.object({
  askingPrice: money,
  offerPrice: money.nullable(),
  debtShare: money,
  maintenanceFeeMonthly: money,
  financingFeeMonthly: money,
  utilitiesMonthly: money,
  otherAcquisitionCosts: money,
  otherSellingCosts: money,
  agentFeeBps: bps(2_000),
  loanToValueBps: bps(10_000),
  loanArrangementFee: money,
  taxProfile: z.enum(TAX_PROFILES),
  actualPurchasePrice: money.nullable(),
  actualRenovationCost: money.nullable(),
  actualHoldingMonths: z.number().min(0).max(120).nullable(),
  actualSalePrice: money.nullable(),
  notes: optText(4000),
  scenarios: z
    .array(scenarioSchema)
    .length(3)
    .refine((s) => new Set(s.map((x) => x.kind)).size === 3, "Need best, expected and worst"),
});
export type DealInput = z.infer<typeof dealSchema>;

export const housingCompanySchema = z.object({
  name: optText(160),
  businessId: z
    .string()
    .trim()
    .regex(/^(\d{7}-\d)?$/, "Business ID format is 1234567-8")
    .nullish()
    .transform((v) => (v ? v : null)),
  managerName: optText(120),
  managerEmail: z
    .string()
    .trim()
    .email()
    .or(z.literal(""))
    .nullish()
    .transform((v) => (v ? v : null)),
  managerPhone: optText(40),
  unitsTotal: z.number().int().min(1).max(5000).nullable(),
  lastPipeRenovationYear: z.number().int().min(1800).max(year + 1).nullable(),
  lastFacadeRenovationYear: z.number().int().min(1800).max(year + 1).nullable(),
  lastRoofRenovationYear: z.number().int().min(1800).max(year + 1).nullable(),
  managerCertificateDate: z.iso.date().nullable(),
  maintenancePlanDate: z.iso.date().nullable(),
  renovationNoticeNotes: optText(4000),
  notes: optText(4000),
});
export type HousingCompanyInput = z.infer<typeof housingCompanySchema>;

export const maintenanceSchema = z.object({
  kind: z.enum(MAINTENANCE_KINDS),
  plannedYear: z.number().int().min(1950).max(year + 40),
  status: z.enum(MAINTENANCE_STATUSES),
  estCostPerM2: money.nullable(),
  source: z.string().trim().min(2, "Where is this from? e.g. “PTS 2026, p. 3”").max(200),
  notes: optText(1000),
});

export const comparableSchema = z.object({
  streetAddress: optText(120),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Postal code is 5 digits"),
  municipality: optText(60),
  buildingType: z.enum(BUILDING_TYPES),
  livingAreaM2: z.number().positive().max(2000),
  rooms: z.number().int().min(1).max(30).nullable(),
  buildYear: z.number().int().min(1700).max(year + 3).nullable(),
  floor: z.number().int().min(-2).max(80).nullable(),
  condition: z.enum(CONDITIONS).nullable(),
  priceDebtFree: money.refine((v) => v > 0, "Enter the price"),
  saleDate: z.iso.date(),
  source: z.string().trim().min(2, "Enter the source").max(200),
  sourceRef: optText(300),
});
export type ComparableInput = z.infer<typeof comparableSchema>;

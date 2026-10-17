import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Conventions
 * - Money is stored as integer euro cents (bigint, mode "number" — safe up to 2^53).
 * - Rates are stored as basis points (1 % = 100 bps).
 * - Every tenant-owned row carries organization_id; access is enforced in src/server/authz.ts.
 */

const cents = (name: string) => bigint(name, { mode: "number" });
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Auth (Better Auth core + organization plugin)                       */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  locale: text("locale").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const planTier = pgEnum("plan_tier", ["free", "pro", "team"]);
export const taxProfile = pgEnum("tax_profile", ["company", "individual"]);
export const vatDisplay = pgEnum("vat_display", ["excl", "incl"]);

/** Tenant. Billing is not built yet; plan_tier / billing_customer_id are placeholders. */
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  planTier: planTier("plan_tier").notNull().default("free"),
  billingCustomerId: text("billing_customer_id"),
  defaultTaxProfile: taxProfile("default_tax_profile").notNull().default("company"),
  /** How prices are shown in the UI. All costs are stored excluding VAT. */
  vatDisplay: vatDisplay("vat_display").notNull().default("excl"),
  /**
   * Whether the org can deduct input VAT on renovation/selling costs.
   * Sales of housing shares are VAT-exempt in Finland, so flippers usually cannot.
   */
  vatDeductible: boolean("vat_deductible").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("member_org_idx").on(t.organizationId),
    uniqueIndex("member_org_user_uq").on(t.organizationId, t.userId),
  ],
);

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

/* ------------------------------------------------------------------ */
/* Editable config (tax rates, defaults, risk thresholds)              */
/* ------------------------------------------------------------------ */

/**
 * organization_id NULL = platform default (editable by platform admins).
 * A row with organization_id overrides the default for that tenant.
 * The row with the latest valid_from <= today wins.
 */
export const configValue = pgTable(
  "config_value",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    value: numeric("value", { mode: "number" }).notNull(),
    unit: text("unit").notNull(), // "bps" | "cents" | "year" | "years" | "count"
    validFrom: date("valid_from").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    notes: text("notes"),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("config_key_idx").on(t.key, t.organizationId)],
);

/* ------------------------------------------------------------------ */
/* Projects & properties                                               */
/* ------------------------------------------------------------------ */

export const projectStatus = pgEnum("project_status", [
  "lead",
  "analyzing",
  "offer_made",
  "purchased",
  "renovating",
  "listed",
  "sold",
]);

export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: projectStatus("status").notNull().default("lead"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    purchasedAt: date("purchased_at"),
    listedAt: date("listed_at"),
    soldAt: date("sold_at"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("project_org_idx").on(t.organizationId, t.status)],
);

export const projectStatusEvent = pgTable("project_status_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  fromStatus: projectStatus("from_status"),
  toStatus: projectStatus("to_status").notNull(),
  changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const buildingType = pgEnum("building_type", [
  "apartment", // kerrostalo
  "rowhouse", // rivitalo
  "semi_detached", // paritalo
]);

export const ownershipForm = pgEnum("ownership_form", [
  "housing_company_share", // asunto-osake (osakehuoneisto)
  "real_estate", // kiinteistö / määräala
]);

export const conditionRating = pgEnum("condition_rating", [
  "good", // hyvä
  "satisfactory", // tyydyttävä
  "fair", // välttävä
  "poor", // huono
]);

export const plotType = pgEnum("plot_type", ["owned", "leased", "unknown"]);

export const property = pgTable(
  "property",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .unique()
      .references(() => project.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    streetAddress: text("street_address").notNull(),
    unit: text("unit"), // e.g. "B 24"
    postalCode: text("postal_code").notNull(),
    municipality: text("municipality").notNull(),
    district: text("district"), // kaupunginosa, e.g. Kallio
    latitude: numeric("latitude", { mode: "number" }),
    longitude: numeric("longitude", { mode: "number" }),
    buildingType: buildingType("building_type").notNull(),
    ownershipForm: ownershipForm("ownership_form").notNull().default("housing_company_share"),
    livingAreaM2: numeric("living_area_m2", { precision: 7, scale: 1, mode: "number" }).notNull(),
    rooms: integer("rooms").notNull(),
    layout: text("layout"), // e.g. "2h+k+s"
    buildYear: integer("build_year").notNull(),
    floor: integer("floor"),
    floorsTotal: integer("floors_total"),
    hasElevator: boolean("has_elevator"),
    hasSauna: boolean("has_sauna").notNull().default(false),
    hasBalcony: boolean("has_balcony").notNull().default(false),
    plotType: plotType("plot_type").notNull().default("unknown"),
    condition: conditionRating("condition").notNull().default("satisfactory"),
    energyClass: text("energy_class"),
    ...timestamps,
  },
  (t) => [index("property_org_idx").on(t.organizationId), index("property_postal_idx").on(t.postalCode)],
);

/** Taloyhtiö — housing company. One per project for now; can be de-duplicated by business ID later. */
export const housingCompany = pgTable("housing_company", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => project.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name"),
  businessId: text("business_id"), // Y-tunnus
  managerName: text("manager_name"), // isännöitsijä
  managerEmail: text("manager_email"),
  managerPhone: text("manager_phone"),
  unitsTotal: integer("units_total"),
  lastPipeRenovationYear: integer("last_pipe_renovation_year"),
  lastFacadeRenovationYear: integer("last_facade_renovation_year"),
  lastRoofRenovationYear: integer("last_roof_renovation_year"),
  managerCertificateDate: date("manager_certificate_date"), // isännöitsijäntodistus
  maintenancePlanDate: date("maintenance_plan_date"), // PTS
  renovationNoticeNotes: text("renovation_notice_notes"), // muutostyöilmoitus process notes
  notes: text("notes"),
  ...timestamps,
});

export const maintenanceKind = pgEnum("maintenance_kind", [
  "pipe_renovation", // putkiremontti / linjasaneeraus
  "facade", // julkisivuremontti
  "roof", // kattoremontti
  "windows",
  "balconies",
  "elevator",
  "electrical",
  "drainage",
  "yard",
  "other",
]);

export const maintenanceStatus = pgEnum("maintenance_status", [
  "planned", // in PTS only
  "decided", // decided at general meeting
  "in_progress",
  "done",
]);

/** Rows from the housing company's long-term maintenance plan (PTS, pitkän tähtäimen suunnitelma). */
export const plannedMaintenance = pgTable("planned_maintenance", {
  id: uuid("id").primaryKey().defaultRandom(),
  housingCompanyId: uuid("housing_company_id")
    .notNull()
    .references(() => housingCompany.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  kind: maintenanceKind("kind").notNull(),
  plannedYear: integer("planned_year").notNull(),
  status: maintenanceStatus("status").notNull().default("planned"),
  estCostPerM2: cents("est_cost_per_m2"),
  source: text("source").notNull(), // e.g. "PTS 2025, p. 4"
  notes: text("notes"),
  ...timestamps,
});

/* ------------------------------------------------------------------ */
/* Deal analysis                                                       */
/* ------------------------------------------------------------------ */

export const dealAnalysis = pgTable("deal_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => project.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  askingPrice: cents("asking_price").notNull(), // myyntihinta (excl. debt share)
  offerPrice: cents("offer_price"), // defaults to asking price when null
  debtShare: cents("debt_share").notNull().default(0), // velkaosuus
  maintenanceFeeMonthly: cents("maintenance_fee_monthly").notNull().default(0), // hoitovastike
  financingFeeMonthly: cents("financing_fee_monthly").notNull().default(0), // rahoitusvastike
  utilitiesMonthly: cents("utilities_monthly").notNull().default(0), // electricity, water, insurance
  otherAcquisitionCosts: cents("other_acquisition_costs").notNull().default(0), // inspection, legal, bank
  otherSellingCosts: cents("other_selling_costs").notNull().default(0), // styling, photos, marketing
  agentFeeBps: integer("agent_fee_bps").notNull(), // excl. VAT, on debt-free sale price
  loanToValueBps: integer("loan_to_value_bps").notNull().default(0), // share of purchase price financed
  loanArrangementFee: cents("loan_arrangement_fee").notNull().default(0),
  taxProfile: taxProfile("tax_profile").notNull().default("company"),
  // Actual outcome (filled for purchased / sold projects; budget tracking comes in Phase 5)
  actualPurchasePrice: cents("actual_purchase_price"),
  actualRenovationCost: cents("actual_renovation_cost"), // excl. VAT
  actualHoldingMonths: numeric("actual_holding_months", { mode: "number" }),
  actualSalePrice: cents("actual_sale_price"), // debt-free
  notes: text("notes"),
  ...timestamps,
});

export const scenarioKind = pgEnum("scenario_kind", ["best", "expected", "worst"]);

export const dealScenario = pgTable(
  "deal_scenario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealAnalysisId: uuid("deal_analysis_id")
      .notNull()
      .references(() => dealAnalysis.id, { onDelete: "cascade" }),
    kind: scenarioKind("kind").notNull(),
    salePriceDebtFree: cents("sale_price_debt_free").notNull(), // velaton myyntihinta
    renovationBudget: cents("renovation_budget").notNull(), // excl. VAT
    contingencyBps: integer("contingency_bps").notNull().default(1000),
    holdingMonths: numeric("holding_months", { mode: "number" }).notNull(),
    interestRateBps: integer("interest_rate_bps").notNull(), // annual
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [uniqueIndex("scenario_deal_kind_uq").on(t.dealAnalysisId, t.kind)],
);

export const riskSeverity = pgEnum("risk_severity", ["info", "medium", "high"]);

/** Manually added risks. Automatic risks are computed on the fly (src/lib/risk). */
export const manualRisk = pgTable("manual_risk", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  detail: text("detail"),
  severity: riskSeverity("severity").notNull().default("medium"),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  ...timestamps,
});

/* ------------------------------------------------------------------ */
/* Market data                                                         */
/* ------------------------------------------------------------------ */

/** Comparable sales — manual entry or CSV import. Licensed adapters can write here later. */
export const comparableSale = pgTable(
  "comparable_sale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "cascade" }),
    streetAddress: text("street_address"),
    postalCode: text("postal_code").notNull(),
    municipality: text("municipality"),
    buildingType: buildingType("building_type").notNull(),
    livingAreaM2: numeric("living_area_m2", { precision: 7, scale: 1, mode: "number" }).notNull(),
    rooms: integer("rooms"),
    buildYear: integer("build_year"),
    floor: integer("floor"),
    condition: conditionRating("condition"),
    priceDebtFree: cents("price_debt_free").notNull(),
    saleDate: date("sale_date").notNull(),
    source: text("source").notNull(), // "Manual entry", "CSV import: file.csv", adapter id
    sourceRef: text("source_ref"),
    enteredBy: text("entered_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("comparable_org_postal_idx").on(t.organizationId, t.postalCode),
    index("comparable_project_idx").on(t.projectId),
  ],
);

/** Cached public statistics (not tenant-specific). */
export const marketSeriesPoint = pgTable(
  "market_series_point",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(), // "statfin"
    sourceTable: text("source_table").notNull(),
    areaCode: text("area_code").notNull(), // postal code
    areaName: text("area_name"),
    buildingSegment: text("building_segment").notNull(), // e.g. "blocks_of_flats", "terraced"
    period: text("period").notNull(), // e.g. "2026Q2" or "2025"
    pricePerM2: cents("price_per_m2"),
    transactions: integer("transactions"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("market_point_uq").on(t.source, t.sourceTable, t.areaCode, t.buildingSegment, t.period),
  ],
);

/* ------------------------------------------------------------------ */
/* Sharing, comments, audit                                            */
/* ------------------------------------------------------------------ */

export const shareRole = pgEnum("share_role", ["viewer", "commenter"]);
export const shareStatus = pgEnum("share_status", ["pending", "active", "revoked"]);

export const projectShare = pgTable(
  "project_share",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    role: shareRole("role").notNull().default("viewer"),
    status: shareStatus("status").notNull().default("pending"),
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("share_user_idx").on(t.userId),
    uniqueIndex("share_project_email_uq").on(t.projectId, t.email),
  ],
);

export const comment = pgTable(
  "comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    target: text("target").notNull().default("project"), // "project" | "deal" | later: photo id etc.
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("comment_project_idx").on(t.projectId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id"),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_org_idx").on(t.organizationId, t.createdAt)],
);

/** Dev-only mail outbox so magic links and invites can be tested without SMTP. */
export const devMail = pgTable("dev_mail", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const projectRelations = relations(project, ({ one, many }) => ({
  organization: one(organization, { fields: [project.organizationId], references: [organization.id] }),
  property: one(property, { fields: [project.id], references: [property.projectId] }),
  housingCompany: one(housingCompany, { fields: [project.id], references: [housingCompany.projectId] }),
  deal: one(dealAnalysis, { fields: [project.id], references: [dealAnalysis.projectId] }),
  comparables: many(comparableSale),
  shares: many(projectShare),
  comments: many(comment),
  manualRisks: many(manualRisk),
  statusEvents: many(projectStatusEvent),
}));

export const propertyRelations = relations(property, ({ one }) => ({
  project: one(project, { fields: [property.projectId], references: [project.id] }),
}));

export const housingCompanyRelations = relations(housingCompany, ({ one, many }) => ({
  project: one(project, { fields: [housingCompany.projectId], references: [project.id] }),
  maintenance: many(plannedMaintenance),
}));

export const plannedMaintenanceRelations = relations(plannedMaintenance, ({ one }) => ({
  housingCompany: one(housingCompany, {
    fields: [plannedMaintenance.housingCompanyId],
    references: [housingCompany.id],
  }),
}));

export const dealAnalysisRelations = relations(dealAnalysis, ({ one, many }) => ({
  project: one(project, { fields: [dealAnalysis.projectId], references: [project.id] }),
  scenarios: many(dealScenario),
}));

export const dealScenarioRelations = relations(dealScenario, ({ one }) => ({
  deal: one(dealAnalysis, { fields: [dealScenario.dealAnalysisId], references: [dealAnalysis.id] }),
}));

export const comparableSaleRelations = relations(comparableSale, ({ one }) => ({
  project: one(project, { fields: [comparableSale.projectId], references: [project.id] }),
}));

export const projectShareRelations = relations(projectShare, ({ one }) => ({
  project: one(project, { fields: [projectShare.projectId], references: [project.id] }),
  user: one(user, { fields: [projectShare.userId], references: [user.id] }),
}));

export const commentRelations = relations(comment, ({ one }) => ({
  project: one(project, { fields: [comment.projectId], references: [project.id] }),
  author: one(user, { fields: [comment.authorId], references: [user.id] }),
}));

export const manualRiskRelations = relations(manualRisk, ({ one }) => ({
  project: one(project, { fields: [manualRisk.projectId], references: [project.id] }),
}));

export const projectStatusEventRelations = relations(projectStatusEvent, ({ one }) => ({
  project: one(project, { fields: [projectStatusEvent.projectId], references: [project.id] }),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, { fields: [member.organizationId], references: [organization.id] }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  projects: many(project),
}));

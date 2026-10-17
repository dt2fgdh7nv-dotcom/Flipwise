/**
 * Seed: platform config defaults + demo workspace with 3 projects, demo users and a client share.
 * Idempotent for config; demo data is recreated when run with --reset-demo (default when the demo org is absent).
 *
 *   pnpm db:seed
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "../src/db/schema";
import { CONFIG_DEFINITIONS } from "../src/lib/config/definitions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: s });

const eur = (v: number) => Math.round(v * 100);
const id = () => randomBytes(12).toString("base64url");
const DEMO_SOURCE = "Demo data (fictional)";
export const DEMO_PASSWORD = "flipwise-demo-2026";

async function seedConfig() {
  const existing = await db.select({ key: s.configValue.key }).from(s.configValue).where(isNull(s.configValue.organizationId));
  const have = new Set(existing.map((e) => e.key));
  const missing = CONFIG_DEFINITIONS.filter((d) => !have.has(d.key));
  if (missing.length) {
    await db.insert(s.configValue).values(
      missing.map((d) => ({
        organizationId: null,
        key: d.key,
        value: d.seed.value,
        unit: d.unit,
        validFrom: d.seed.validFrom,
        source: d.seed.source,
        sourceUrl: d.seed.sourceUrl ?? null,
        notes: d.seed.notes ?? null,
      })),
    );
  }
  console.log(`config: ${missing.length} platform defaults inserted`);
}

async function createUser(email: string, name: string, opts: { platformAdmin?: boolean } = {}) {
  const userId = id();
  await db.insert(s.user).values({ id: userId, email, name, emailVerified: true, isPlatformAdmin: Boolean(opts.platformAdmin) });
  await db.insert(s.account).values({
    id: id(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(DEMO_PASSWORD),
  });
  return userId;
}

async function createOrg(name: string, slug: string, members: { userId: string; role: "owner" | "admin" | "member" }[]) {
  const orgId = id();
  await db.insert(s.organization).values({ id: orgId, name, slug, planTier: "pro", defaultTaxProfile: "company", vatDisplay: "excl", vatDeductible: false });
  await db.insert(s.member).values(members.map((m) => ({ id: id(), organizationId: orgId, userId: m.userId, role: m.role })));
  return orgId;
}

type ProjectSeed = {
  name: string;
  status: (typeof s.projectStatus.enumValues)[number];
  dates?: { purchasedAt?: string; listedAt?: string; soldAt?: string };
  property: Omit<typeof s.property.$inferInsert, "projectId" | "organizationId">;
  hc: Omit<typeof s.housingCompany.$inferInsert, "projectId" | "organizationId"> | null;
  pts: Omit<typeof s.plannedMaintenance.$inferInsert, "housingCompanyId" | "organizationId">[];
  deal: Omit<typeof s.dealAnalysis.$inferInsert, "projectId" | "organizationId">;
  expected: { sale: number; reno: number; months: number; interestBps: number };
  comps: Omit<typeof s.comparableSale.$inferInsert, "projectId" | "organizationId" | "source" | "buildingType" | "postalCode" | "municipality">[];
};

async function createProject(orgId: string, createdBy: string, p: ProjectSeed) {
  const [proj] = await db
    .insert(s.project)
    .values({ organizationId: orgId, name: p.name, status: p.status, createdBy, ...p.dates })
    .returning();
  await db.insert(s.projectStatusEvent).values({ projectId: proj.id, toStatus: p.status, changedBy: createdBy });
  await db.insert(s.property).values({ ...p.property, projectId: proj.id, organizationId: orgId });
  if (p.hc) {
    const [hc] = await db.insert(s.housingCompany).values({ ...p.hc, projectId: proj.id, organizationId: orgId }).returning();
    if (p.pts.length) {
      await db.insert(s.plannedMaintenance).values(p.pts.map((m) => ({ ...m, housingCompanyId: hc.id, organizationId: orgId })));
    }
  }
  const [deal] = await db.insert(s.dealAnalysis).values({ ...p.deal, projectId: proj.id, organizationId: orgId }).returning();
  const e = p.expected;
  const round = (v: number, step: number) => Math.round(v / step) * step;
  await db.insert(s.dealScenario).values([
    { dealAnalysisId: deal.id, kind: "best", salePriceDebtFree: round(e.sale * 1.05, eur(1000)), renovationBudget: round(e.reno * 0.95, eur(100)), contingencyBps: 500, holdingMonths: Math.max(1, e.months - 1), interestRateBps: e.interestBps - 50 },
    { dealAnalysisId: deal.id, kind: "expected", salePriceDebtFree: e.sale, renovationBudget: e.reno, contingencyBps: 1000, holdingMonths: e.months, interestRateBps: e.interestBps },
    { dealAnalysisId: deal.id, kind: "worst", salePriceDebtFree: round(e.sale * 0.92, eur(1000)), renovationBudget: round(e.reno * 1.25, eur(100)), contingencyBps: 1500, holdingMonths: e.months + 3, interestRateBps: e.interestBps + 100 },
  ]);
  if (p.comps.length) {
    await db.insert(s.comparableSale).values(
      p.comps.map((c) => ({
        ...c,
        organizationId: orgId,
        projectId: proj.id,
        postalCode: p.property.postalCode,
        municipality: p.property.municipality,
        buildingType: p.property.buildingType,
        source: DEMO_SOURCE,
        enteredBy: createdBy,
      })),
    );
  }
  return proj.id;
}

async function resetDemo() {
  const emails = ["demo@flipwise.fi", "tuomas@flipwise.fi", "client@flipwise.fi", "admin@flipwise.fi", "other@flipwise.fi"];
  const users = await db.select({ id: s.user.id }).from(s.user).where(inArray(s.user.email, emails));
  await db.delete(s.organization).where(inArray(s.organization.slug, ["demo-flips", "other-flips"]));
  if (users.length) await db.delete(s.user).where(inArray(s.user.id, users.map((u) => u.id)));
}

async function seedDemo() {
  await resetDemo();
  const owner = await createUser("demo@flipwise.fi", "Aino Virtanen");
  const member = await createUser("tuomas@flipwise.fi", "Tuomas Laine");
  const client = await createUser("client@flipwise.fi", "Mikael Berg");
  await createUser("admin@flipwise.fi", "Platform Admin", { platformAdmin: true });
  const other = await createUser("other@flipwise.fi", "Other Tenant");

  const orgId = await createOrg("Demo Flips Oy", "demo-flips", [
    { userId: owner, role: "owner" },
    { userId: member, role: "member" },
  ]);
  const otherOrg = await createOrg("Other Flips Oy", "other-flips", [{ userId: other, role: "owner" }]);

  // 1) Helsinki apartment — Kallio, being analysed
  const helsinki = await createProject(orgId, owner, {
    name: "Kallio 2h+k — 1930s classic",
    status: "analyzing",
    property: {
      streetAddress: "Esimerkkikatu 21",
      unit: "B 34",
      postalCode: "00530",
      municipality: "Helsinki",
      district: "Kallio",
      buildingType: "apartment",
      ownershipForm: "housing_company_share",
      livingAreaM2: 48.5,
      rooms: 2,
      layout: "2h+k",
      buildYear: 1938,
      floor: 4,
      floorsTotal: 6,
      hasElevator: true,
      hasSauna: false,
      hasBalcony: false,
      plotType: "owned",
      condition: "fair",
      energyClass: "E",
    },
    hc: {
      name: "Asunto Oy Esimerkkikatu 21 (demo)",
      managerName: "Isännöinti Demo Oy",
      managerEmail: "isannoitsija@example.com",
      unitsTotal: 42,
      lastPipeRenovationYear: 2011,
      lastFacadeRenovationYear: 1994,
      lastRoofRenovationYear: 2006,
      managerCertificateDate: "2026-09-22",
      maintenancePlanDate: "2026-03-15",
      renovationNoticeNotes: "Board meets monthly; send muutostyöilmoitus 3 weeks ahead. Wet-room work requires the company's supervisor.",
    },
    pts: [
      { kind: "facade", plannedYear: 2028, status: "planned", estCostPerM2: eur(450), source: "PTS 2026–2035 (demo), p. 3" },
      { kind: "windows", plannedYear: 2030, status: "planned", estCostPerM2: eur(250), source: "PTS 2026–2035 (demo), p. 3" },
      { kind: "roof", plannedYear: 2034, status: "planned", estCostPerM2: eur(120), source: "PTS 2026–2035 (demo), p. 4" },
    ],
    deal: {
      askingPrice: eur(215_000),
      debtShare: eur(4_800),
      maintenanceFeeMonthly: eur(238),
      financingFeeMonthly: eur(46),
      utilitiesMonthly: eur(60),
      otherAcquisitionCosts: eur(600),
      otherSellingCosts: eur(1_800),
      agentFeeBps: 300,
      loanToValueBps: 6000,
      loanArrangementFee: eur(900),
      taxProfile: "company",
      notes: "Original 1938 kitchen and 1990s bathroom. Good light, 4th floor with elevator.",
    },
    expected: { sale: eur(312_000), reno: eur(34_000), months: 5, interestBps: 550 },
    comps: [
      { streetAddress: "Esimerkkikatu 5", livingAreaM2: 52, rooms: 2, buildYear: 1929, floor: 3, condition: "good", priceDebtFree: eur(338_000), saleDate: "2026-08-14" },
      { streetAddress: "Demotie 2", livingAreaM2: 34.5, rooms: 1, buildYear: 1936, floor: 2, condition: "satisfactory", priceDebtFree: eur(199_000), saleDate: "2026-06-02" },
      { streetAddress: "Esimerkkikatu 30", livingAreaM2: 46, rooms: 2, buildYear: 1940, floor: 5, condition: "good", priceDebtFree: eur(295_000), saleDate: "2026-05-20" },
      { streetAddress: "Mallikatu 8", livingAreaM2: 55.5, rooms: 2, buildYear: 1955, floor: 1, condition: "fair", priceDebtFree: eur(279_000), saleDate: "2026-03-11" },
      { streetAddress: "Mallikatu 14", livingAreaM2: 71, rooms: 3, buildYear: 1927, floor: 4, condition: "good", priceDebtFree: eur(449_000), saleDate: "2026-07-01" },
    ],
  });

  // 2) Porvoo rowhouse — lead with a pipe renovation coming
  await createProject(orgId, member, {
    name: "Porvoo rivitalo 4h+k+s",
    status: "lead",
    property: {
      streetAddress: "Esimerkkitie 12",
      unit: "C 5",
      postalCode: "06100",
      municipality: "Porvoo",
      district: null,
      buildingType: "rowhouse",
      ownershipForm: "housing_company_share",
      livingAreaM2: 92,
      rooms: 4,
      layout: "4h+k+s",
      buildYear: 1979,
      floor: 1,
      floorsTotal: 2,
      hasElevator: false,
      hasSauna: true,
      hasBalcony: false,
      plotType: "owned",
      condition: "satisfactory",
    },
    hc: {
      name: "Asunto Oy Porvoon Esimerkkirivi (demo)",
      unitsTotal: 12,
      lastPipeRenovationYear: null,
      lastRoofRenovationYear: 2004,
      managerCertificateDate: null,
      maintenancePlanDate: "2025-11-01",
    },
    pts: [
      { kind: "pipe_renovation", plannedYear: 2028, status: "planned", estCostPerM2: eur(650), source: "PTS 2025 (demo), p. 2", notes: "Includes bathrooms and saunas." },
      { kind: "roof", plannedYear: 2031, status: "planned", estCostPerM2: eur(120), source: "PTS 2025 (demo), p. 2" },
    ],
    deal: {
      askingPrice: eur(159_000),
      debtShare: 0,
      maintenanceFeeMonthly: eur(350),
      financingFeeMonthly: 0,
      utilitiesMonthly: eur(120),
      otherAcquisitionCosts: eur(800),
      otherSellingCosts: eur(1_500),
      agentFeeBps: 320,
      loanToValueBps: 6000,
      loanArrangementFee: eur(900),
      taxProfile: "company",
      notes: "End unit with own yard. Ask isännöitsijä about the pipe renovation timeline before any offer.",
    },
    expected: { sale: eur(238_000), reno: eur(38_000), months: 6, interestBps: 550 },
    comps: [
      { streetAddress: "Demopolku 3", livingAreaM2: 89, rooms: 4, buildYear: 1981, floor: 1, condition: "good", priceDebtFree: eur(239_000), saleDate: "2026-07-15" },
      { streetAddress: "Esimerkkitie 4", livingAreaM2: 76, rooms: 3, buildYear: 1978, floor: 1, condition: "satisfactory", priceDebtFree: eur(172_000), saleDate: "2026-04-02" },
      { streetAddress: "Mallitie 9", livingAreaM2: 94, rooms: 4, buildYear: 1975, floor: 1, condition: "fair", priceDebtFree: eur(168_000), saleDate: "2026-02-20" },
      { streetAddress: "Demopolku 11", livingAreaM2: 91, rooms: 4, buildYear: 1984, floor: 1, condition: "good", priceDebtFree: eur(249_000), saleDate: "2026-09-03" },
    ],
  });

  // 3) Sold project — Vantaa Tikkurila, full numbers incl. actuals
  const sold = await createProject(orgId, owner, {
    name: "Tikkurila 3h+k — sold",
    status: "sold",
    dates: { purchasedAt: "2025-09-15", listedAt: "2026-02-20", soldAt: "2026-03-28" },
    property: {
      streetAddress: "Mallikuja 4",
      unit: "A 9",
      postalCode: "01300",
      municipality: "Vantaa",
      district: "Tikkurila",
      buildingType: "apartment",
      ownershipForm: "housing_company_share",
      livingAreaM2: 71,
      rooms: 3,
      layout: "3h+k",
      buildYear: 1972,
      floor: 3,
      floorsTotal: 4,
      hasElevator: false,
      hasSauna: false,
      hasBalcony: true,
      plotType: "owned",
      condition: "poor",
    },
    hc: {
      name: "Asunto Oy Tikkurilan Malli (demo)",
      unitsTotal: 36,
      lastPipeRenovationYear: 2019,
      lastFacadeRenovationYear: 2008,
      managerCertificateDate: "2025-08-20",
      maintenancePlanDate: "2025-05-01",
    },
    pts: [
      { kind: "pipe_renovation", plannedYear: 2019, status: "done", estCostPerM2: eur(780), source: "Isännöitsijäntodistus 2025 (demo)" },
      { kind: "windows", plannedYear: 2029, status: "planned", estCostPerM2: eur(180), source: "PTS 2025 (demo), p. 5" },
    ],
    deal: {
      askingPrice: eur(169_000),
      offerPrice: eur(152_000),
      debtShare: eur(21_500),
      maintenanceFeeMonthly: eur(305),
      financingFeeMonthly: eur(220),
      utilitiesMonthly: eur(70),
      otherAcquisitionCosts: eur(700),
      otherSellingCosts: eur(1_600),
      agentFeeBps: 280,
      loanToValueBps: 6000,
      loanArrangementFee: eur(800),
      taxProfile: "company",
      actualPurchasePrice: eur(152_000),
      actualRenovationCost: eur(36_900),
      actualHoldingMonths: 6.5,
      actualSalePrice: eur(259_500),
      notes: "Fresh pipe renovation (2019) was the main selling point. Kitchen + flooring + paint; bathroom already new.",
    },
    expected: { sale: eur(256_000), reno: eur(35_200), months: 6, interestBps: 500 },
    comps: [
      { streetAddress: "Mallikuja 8", livingAreaM2: 72, rooms: 3, buildYear: 1971, floor: 2, condition: "good", priceDebtFree: eur(262_000), saleDate: "2026-01-20" },
      { streetAddress: "Demokuja 1", livingAreaM2: 70.5, rooms: 3, buildYear: 1974, floor: 4, condition: "satisfactory", priceDebtFree: eur(228_000), saleDate: "2025-11-05" },
      { streetAddress: "Mallikuja 2", livingAreaM2: 55, rooms: 2, buildYear: 1972, floor: 1, condition: "good", priceDebtFree: eur(199_000), saleDate: "2026-02-10" },
    ],
  });

  // Other tenant — used to verify isolation
  await createProject(otherOrg, other, {
    name: "Other tenant's secret flip",
    status: "analyzing",
    property: { streetAddress: "Salainen katu 1", postalCode: "00100", municipality: "Helsinki", buildingType: "apartment", ownershipForm: "housing_company_share", livingAreaM2: 40, rooms: 1, buildYear: 1960, condition: "fair" },
    hc: null,
    pts: [],
    deal: { askingPrice: eur(200_000), agentFeeBps: 300, taxProfile: "company" },
    expected: { sale: eur(250_000), reno: eur(20_000), months: 4, interestBps: 550 },
    comps: [],
  });

  // Client shares
  const tokenHash = () => createHash("sha256").update(randomBytes(32)).digest("hex");
  const expiresAt = new Date(Date.now() + 365 * 86_400_000);
  await db.insert(s.projectShare).values([
    { projectId: helsinki, organizationId: orgId, email: "client@flipwise.fi", userId: client, role: "commenter", status: "active", tokenHash: tokenHash(), invitedBy: owner, acceptedAt: new Date(), expiresAt },
    { projectId: sold, organizationId: orgId, email: "client@flipwise.fi", userId: client, role: "viewer", status: "active", tokenHash: tokenHash(), invitedBy: owner, acceptedAt: new Date(), expiresAt },
  ]);
  await db.insert(s.comment).values({
    projectId: helsinki,
    organizationId: orgId,
    authorId: client,
    body: "Looks interesting. What happens to the numbers if the facade renovation is decided before we sell?",
  });

  console.log("demo: users, 2 workspaces, 4 projects, shares created");
}

async function main() {
  await seedConfig();
  const demoExists = await db.select({ id: s.organization.id }).from(s.organization).where(eq(s.organization.slug, "demo-flips"));
  if (demoExists.length === 0 || process.argv.includes("--reset-demo")) await seedDemo();
  else console.log("demo: already present (use --reset-demo to recreate)");
  await pool.end();
  console.log(`\nDemo logins (password: ${DEMO_PASSWORD}):
  demo@flipwise.fi    owner, Demo Flips Oy
  tuomas@flipwise.fi  member, Demo Flips Oy
  client@flipwise.fi  client (shared projects only)
  admin@flipwise.fi   platform admin
  other@flipwise.fi   owner, Other Flips Oy (isolation testing)`);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});

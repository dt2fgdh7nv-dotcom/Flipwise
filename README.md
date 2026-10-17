# FlipWise

Analyse, plan and manage apartment (kerrostalo) and rowhouse (rivitalo) flips in Finland. Multi-tenant SaaS.

> Estimates only — verify with a tax advisor, isännöitsijä, and licensed professionals.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, server actions) + TypeScript |
| UI | Tailwind CSS v4, Radix primitives, lucide icons, Recharts |
| i18n | next-intl (English now; `messages/fi.json`, `sv.json` can be added) |
| DB | PostgreSQL + Drizzle ORM (EU-region managed Postgres in production) |
| Auth | Better Auth — email + password, magic link, organizations (tenants), invitations |
| Tests | Vitest (engine, risk rules, parsers, authz against DB), Playwright (desktop + mobile smoke) |

## Getting started

**Not a developer?** See [GETTING-STARTED.md](GETTING-STARTED.md): install Node.js, then double-click
`start-windows.bat` or `start-mac.command`.

Developers:

```bash
pnpm install
pnpm run bootstrap              # creates .env, applies migrations, seeds config + demo data
pnpm dev                        # http://localhost:3000
```

By default the app uses an **embedded PostgreSQL (PGlite)** stored in `.data/` — no database to install.
Set `DATABASE_URL=postgres://…` in `.env` to use a real PostgreSQL instead (`docker compose up -d` starts one
locally); production always uses PostgreSQL. The embedded database must only be opened by one process at a time,
so stop the app before running `pnpm db:seed` / `pnpm db:reset-demo` against it.

Demo logins (password `flipwise-demo-2026`):

| Email | Role |
|---|---|
| demo@flipwise.fi | Owner of *Demo Flips Oy* |
| tuomas@flipwise.fi | Member of *Demo Flips Oy* |
| client@flipwise.fi | Client — Kallio project (can comment) and sold Tikkurila project (view only) |
| admin@flipwise.fi | Platform admin (`/admin`) |
| other@flipwise.fi | Owner of *Other Flips Oy* — for tenant-isolation testing |

In development, emails (magic links, invites, password resets) are captured at **/dev/mail**.

### Scripts

| Script | |
|---|---|
| `pnpm run bootstrap` | One-step local setup (safe to repeat) |
| `pnpm test` | Unit + integration tests (integration tests need a seeded PostgreSQL via `DATABASE_URL`) |
| `pnpm test:e2e` | Playwright smoke tests against a running app (`pnpm build && pnpm start` first). Set `PLAYWRIGHT_CHROMIUM_PATH` to use a preinstalled Chromium. |
| `pnpm typecheck` / `pnpm lint` | |
| `pnpm db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `pnpm db:studio` | Drizzle Studio |

## Architecture notes

**Tenancy & authorization.** Every tenant row carries `organization_id`. All access goes through
`src/server/authz.ts`: `assertOrg(role)` for workspace actions and `assertProjectAccess(projectId, level)`
for project data (org members → edit; clients with an active, unexpired share → view or comment).
Queries then filter by the organization id returned from the check, never by a client-supplied one.
`src/test/server-actions-guard.test.ts` fails the build if a server action forgets the check, and
`src/test/authz.integration.test.ts` verifies isolation against the database.

**Money and rates.** Money is stored as integer cents, rates as basis points. Renovation costs are stored
excluding VAT and shown per the workspace setting. Because selling housing shares is VAT-exempt, the deal
engine adds VAT to renovation and agent costs unless the workspace says it can deduct input VAT.

**Deal engine.** `src/lib/finance/deal-engine.ts` is pure and shared by server and browser (live
recalculation). It models housing-company shares correctly: debt-free price = price + velkaosuus, transfer tax
on the debt-free price, rahoitusvastike as a holding cost, agent fee on the debt-free sale price. Tax:
corporate tax (Oy) or progressive capital income tax with the deemed acquisition cost (individuals).
Every result lists the assumptions it made.

**Editable config.** Tax rates, defaults and risk thresholds live in `config_value` with source, URL and
valid-from date. Platform admins version the defaults at `/admin`; workspace admins can override per tenant
at *Settings → Rates & assumptions*. Seed values are in `src/lib/config/definitions.ts`.

**Risk flags.** `src/lib/risk/risk-rules.ts`: upcoming PTS works (putkiremontti/facade/roof flagged high),
pipe renovation overdue, asbestos survey for pre-1994 buildings, muutostyöilmoitus, missing
isännöitsijäntodistus/PTS, high debt share, leased plot, individual business-income risk, scenario losses.
Each flag carries its basis (law, config source or PTS reference).

**Renovation cost estimator.** `cost_item` holds the catalogue: platform items (edited at `/admin/costs`,
CSV import/export by `code`) plus per-workspace price overrides and custom items (*Cost database*). Each item has
budget / mid / premium price ranges (euros excl. VAT per m², lm, pcs, set or room), labour share, certification
needs (waterproofing, electrical, plumbing, asbestos), a muutostyöilmoitus flag, source and price date. Plans
(`renovation_plan` → `plan_room` → `plan_line`) snapshot prices when an item is added, so catalogue edits never
silently change a plan ("Refresh prices" re-applies them). "Add typical items" uses `src/lib/renovation/templates.ts`
to suggest items and quantities from room type and floor area. "Use in deal scenarios" sets the best / expected /
worst renovation budgets to the low / typical / high end of the plan. **Seed prices are provisional FlipWise
estimates** — replace them with sourced prices (contractor price list, own projects) via CSV import.

**Market data.** `src/server/market/`: adapter interfaces for licensed comparable-sales feeds and public
statistics. Statistics Finland PxWeb is implemented (metadata-driven, cached 7 days, degrades gracefully).
Oikotie, Etuovi and asuntojen.hintatiedot.fi are **not scraped**; comparables come from manual entry or CSV
import (template downloadable in-app, Finnish number/date formats accepted). Every data point shows source and date.

**GDPR.** Self-hosted auth (user data stays in our EU database), share tokens stored as hashes, audit log of
sensitive actions, no tracking. Export/deletion self-service is scheduled for phase 6.

**Billing (prepared).** `organization.plan_tier` and `billing_customer_id` exist; no billing logic yet.

## Project layout

```
src/
  app/(auth)/          sign-in, sign-up, magic link, reset, onboarding, invite acceptance
  app/app/             flipper workspace: dashboard, projects, project tabs, settings
  app/portal/          client portal (shared projects only)
  app/admin/           platform admin (config versions, tenants)
  components/          ui primitives, shared (Term glossary, Disclaimer, SourceTag), feature components
  db/                  Drizzle schema + client
  lib/                 pure logic: deal engine, risk rules, config, CSV, formatting, validation
  server/              auth, authz, data loaders, server actions, market adapters, mailer
messages/en.json       all UI strings
scripts/seed.ts        config defaults + demo data
```

## Roadmap

- [x] Phase 0 — foundation: auth, tenants, roles, i18n, design system, config, seed
- [x] Phase 1 — deal analysis, scenarios, risk flags, housing company & PTS, comparables + CSV, StatFin trend, client sharing & portal
- [x] Phase 2 — renovation cost estimator (room builder, admin-editable cost database, plan → deal scenarios)
- [ ] Phase 3 — AI renovation suggestions
- [ ] Phase 4 — photos, AI analysis, AI "after" images (Replicate), before/after slider
- [ ] Phase 5 — project management: tasks/timeline, contractors, budget vs actual, documents
- [ ] Phase 6 — PDF deal report, GDPR export/delete, production mail, hardening

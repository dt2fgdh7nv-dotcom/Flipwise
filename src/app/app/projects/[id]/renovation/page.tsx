import { AlertTriangle, ClipboardCheck, HardHat } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AddRoomButton, PlanSummary, RoomCard } from "@/components/renovation/plan-builder";
import { Disclaimer } from "@/components/shared/disclaimer";
import { Term } from "@/components/shared/term";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEED_SOURCE } from "@/lib/costs/seed-catalogue";
import { requireProjectAccess } from "@/server/authz";
import { getEffectiveConfig } from "@/server/data/config";
import { getEffectiveCatalogue, getPlan, planView } from "@/server/data/costs";
import { getProjectBundle } from "@/server/data/projects";

export const metadata = { title: "Renovation plan" };

export default async function RenovationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "edit");
  const b = (await getProjectBundle(id))!;
  const [plan, catalogue, config] = await Promise.all([getPlan(id), getEffectiveCatalogue(b.organizationId), getEffectiveConfig(b.organizationId)]);
  const { rooms, totals, defaultTier } = planView(plan);
  const t = await getTranslations("renovation");
  const tc = await getTranslations("certification");
  const vatBps = config["tax.vat.general"].value;
  const expected = b.deal?.scenarios.find((s) => s.kind === "expected");
  const hasLines = rooms.some((r) => r.lines.length);
  const provisional = rooms.some((r) => r.lines.some((l) => l.source === SEED_SOURCE));
  const isShare = b.property?.ownershipForm === "housing_company_share";
  const asbestosYear = config["risk.asbestos_survey_before_year"].value;
  const hasAsbestosSurvey = rooms.some((r) => r.lines.some((l) => l.code === "general.asbestos_survey"));
  const catalogueOptions = catalogue.map((c) => ({
    id: c.id,
    code: c.code,
    category: c.category,
    nameEn: c.nameEn,
    nameFi: c.nameFi,
    unit: c.unit,
    budgetLow: c.budgetLow,
    budgetHigh: c.budgetHigh,
    midLow: c.midLow,
    midHigh: c.midHigh,
    premiumLow: c.premiumLow,
    premiumHigh: c.premiumHigh,
    certification: c.certification,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PlanSummary projectId={id} totals={totals.plan} tier={defaultTier} vatDisplay={b.org.vatDisplay} vatBps={vatBps} dealExpectedBudget={expected?.renovationBudget ?? null} hasLines={hasLines} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("title")}</h2>
            <AddRoomButton projectId={id} defaultTier={defaultTier} />
          </div>
          {rooms.length === 0 ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{t("emptyPlan")}</p> : null}
          {rooms.map((r) => (
            <RoomCard key={r.id} projectId={id} room={r} totals={totals.byRoom[r.id]} catalogue={catalogueOptions} defaultTier={defaultTier} vatDisplay={b.org.vatDisplay} vatBps={vatBps} />
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {provisional ? (
            <Alert tone="warning">
              {t("provisional")}{" "}
              <Link href="/app/costs" className="underline">
                →
              </Link>
            </Alert>
          ) : null}
          {b.property && b.property.buildYear < asbestosYear && !hasAsbestosSurvey && hasLines ? (
            <Alert tone="warning" title={<Term k="asbestikartoitus" />}>
              {t("asbestosReminder", { year: b.property.buildYear })}
            </Alert>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardHat className="size-4 text-primary" /> {t("professionals")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totals.certifications.length === 0 ? (
                <p className="text-sm text-muted">{t("professionalsNone")}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {totals.certifications.map((c) => (
                    <li key={c} className="text-sm">
                      <p className="font-medium">{tc(`${c}.label`)}</p>
                      <p className="mt-0.5 text-muted">{tc(`${c}.detail`)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {isShare && totals.noticeLines > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-primary" /> <Term k="muutostyoilmoitus">{t("noticeTitle")}</Term>
                </CardTitle>
                <CardDescription>{t("noticeBody", { count: totals.noticeLines })}</CardDescription>
              </CardHeader>
              {b.housingCompany?.renovationNoticeNotes ? (
                <CardContent className="flex gap-2 text-sm text-muted">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {b.housingCompany.renovationNoticeNotes}
                </CardContent>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
      <Disclaimer variant="long" />
    </div>
  );
}

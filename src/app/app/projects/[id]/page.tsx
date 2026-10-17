import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CommentsThread } from "@/components/projects/comments-thread";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { DeleteManualRiskButton, ManualRiskForm } from "@/components/projects/manual-risk-form";
import { fromProperty } from "@/lib/forms/property-form";
import { PropertyEditButton } from "@/components/projects/property-edit";
import { RiskList } from "@/components/projects/risk-list";
import { Disclaimer } from "@/components/shared/disclaimer";
import { Stat } from "@/components/shared/stat";
import { Term } from "@/components/shared/term";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { formatDate, formatEur, formatPct } from "@/lib/format";
import { requireProjectAccess } from "@/server/authz";
import { listComments } from "@/server/data/comments";
import { analyzeProject, getProjectBundle } from "@/server/data/projects";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "edit");
  const b = (await getProjectBundle(id))!;
  const [{ results, actual, risks }, comments, events] = await Promise.all([
    analyzeProject(b),
    listComments(id, b.organizationId),
    db.query.projectStatusEvent.findMany({ where: (e, { eq }) => eq(e.projectId, id), orderBy: (e, { desc }) => [desc(e.createdAt)], limit: 10 }),
  ]);
  const t = await getTranslations("overview");
  const tp = await getTranslations("property");
  const tc = await getTranslations("common");
  const td = await getTranslations("deal");
  const tr = await getTranslations("risks");
  const ts = await getTranslations("status");
  const tb = await getTranslations("buildingType");
  const to = await getTranslations("ownershipForm");
  const tcond = await getTranslations("condition");
  const tplot = await getTranslations("plotType");
  const expected = results.find((r) => r.kind === "expected");
  const shown = actual ?? expected;
  const pr = b.property;

  const yesNo = (v: boolean | null) => (v === null ? tc("unknown") : v ? tc("yes") : tc("no"));
  const details: [string, React.ReactNode][] = pr
    ? [
        [tp("buildingType"), tb(pr.buildingType)],
        [tp("ownershipForm"), to(pr.ownershipForm)],
        [tp("livingArea"), `${pr.livingAreaM2} m²`],
        [tp("rooms"), `${pr.rooms}${pr.layout ? ` (${pr.layout})` : ""}`],
        [tp("buildYear"), pr.buildYear],
        [tp("floor"), pr.floor !== null ? `${pr.floor}${pr.floorsTotal ? ` / ${pr.floorsTotal}` : ""}` : "—"],
        [tp("hasElevator"), yesNo(pr.hasElevator)],
        [tp("hasSauna"), yesNo(pr.hasSauna)],
        [tp("hasBalcony"), yesNo(pr.hasBalcony)],
        [tp("plotType"), tplot(pr.plotType)],
        [tp("condition"), tcond(pr.condition)],
        [tp("energyClass"), pr.energyClass ?? "—"],
      ]
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        {shown ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{actual ? td("actual") : t("summary")}</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/app/projects/${id}/deal`}>
                  {t("openDeal")} <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label={td("line.profitAfterTax")} value={formatEur(shown.profitAfterTax)} tone={shown.profitAfterTax < 0 ? "negative" : "positive"} />
              <Stat label={td("line.roi")} value={formatPct(shown.roi)} hint={`${td("line.annualizedRoi")}: ${formatPct(shown.annualizedRoi)}`} />
              <Stat label={td("line.totalCost")} value={formatEur(shown.totalCost)} />
              <Stat label={td("line.breakEven")} value={formatEur(shown.breakEvenSalePrice)} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{tr("title")}</CardTitle>
              <CardDescription>{tr("description")}</CardDescription>
            </div>
            <ManualRiskForm projectId={id} />
          </CardHeader>
          <CardContent>
            <RiskList flags={risks} />
            {b.manualRisks.length ? (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t("manualRisks")}</p>
                <ul className="flex flex-col gap-2">
                  {b.manualRisks.map((m) => (
                    <li key={m.id} className="flex items-start justify-between gap-2">
                      <RiskList flags={[]} manual={[{ id: m.id, title: m.title, detail: m.detail, severity: m.severity }]} />
                      <DeleteManualRiskButton projectId={id} riskId={m.id} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("comments")}</CardTitle>
            <CardDescription>{t("commentsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CommentsThread projectId={id} comments={comments} canComment />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        {pr ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{tp("title")}</CardTitle>
              <PropertyEditButton projectId={id} name={b.name} initial={fromProperty(pr)} />
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
                {details.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
              {pr.ownershipForm === "housing_company_share" ? (
                <p className="mt-4 text-xs text-muted">
                  <Term k="taloyhtio" />: {b.housingCompany?.name ?? "—"}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("timeline")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span>{ts(e.toStatus)}</span>
                  <span className="text-muted">{formatDate(e.createdAt)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="border-danger/30">
          <CardHeader>
            <CardTitle className="text-danger">{t("dangerZone")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DeleteProjectButton projectId={id} />
          </CardContent>
        </Card>
      </div>
      <Disclaimer className="lg:col-span-3" />
    </div>
  );
}

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AssumptionsList } from "@/components/projects/assumptions-list";
import { CommentsThread } from "@/components/projects/comments-thread";
import { DealResultsTable } from "@/components/projects/deal-results-table";
import { RiskList } from "@/components/projects/risk-list";
import { Disclaimer } from "@/components/shared/disclaimer";
import { Stat } from "@/components/shared/stat";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEur, formatPct } from "@/lib/format";
import { requireProjectAccess } from "@/server/authz";
import { listComments } from "@/server/data/comments";
import { analyzeProject, getProjectBundle } from "@/server/data/projects";

export const metadata = { title: "Shared project" };

/** Client view. Renders only client-safe fields: no internal notes, contacts or manual risk notes. */
export default async function PortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id, "view");
  const b = (await getProjectBundle(id))!;
  const [{ results, actual, risks }, comments] = await Promise.all([analyzeProject(b), listComments(id, b.organizationId)]);
  const t = await getTranslations("portal");
  const td = await getTranslations("deal");
  const tr = await getTranslations("risks");
  const ta = await getTranslations("assumptions");
  const to = await getTranslations("overview");
  const tb = await getTranslations("buildingType");
  const to2 = await getTranslations("ownershipForm");
  const tcond = await getTranslations("condition");
  const tp = await getTranslations("property");
  const expected = results.find((r) => r.kind === "expected");
  const shown = actual ?? expected;
  const pr = b.property;
  const canComment = access.level === "comment" || access.level === "edit";

  return (
    <>
      <Link href={access.kind === "member" ? `/app/projects/${id}` : "/portal"} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="size-4" /> {t("title")}
      </Link>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{b.name}</h1>
          {pr ? (
            <p className="mt-1 text-sm text-muted">
              {pr.streetAddress}, {pr.postalCode} {pr.municipality} · {pr.livingAreaM2} m² · {pr.buildYear}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={b.status} />
          <Badge tone="info">{canComment ? t("canComment") : t("readOnly")}</Badge>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {shown ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={td("line.profitAfterTax")} value={formatEur(shown.profitAfterTax)} tone={shown.profitAfterTax < 0 ? "negative" : "positive"} />
            <Stat label={td("line.roi")} value={formatPct(shown.roi)} hint={`${td("line.annualizedRoi")}: ${formatPct(shown.annualizedRoi)}`} />
            <Stat label={td("line.totalCost")} value={formatEur(shown.totalCost)} />
            <Stat label={td("line.salePrice")} value={formatEur(shown.selling.salePriceDebtFree)} />
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("summary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DealResultsTable results={results} actual={actual} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{tr("title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <RiskList flags={risks.filter((r) => r.code !== "individual_business_income")} />
            </CardContent>
          </Card>
          {pr ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("property")}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted">{tp("buildingType")}</dt>
                  <dd className="text-right">{tb(pr.buildingType)}</dd>
                  <dt className="text-muted">{tp("ownershipForm")}</dt>
                  <dd className="text-right">{to2(pr.ownershipForm)}</dd>
                  <dt className="text-muted">{tp("rooms")}</dt>
                  <dd className="text-right">{pr.layout ?? pr.rooms}</dd>
                  <dt className="text-muted">{tp("buildYear")}</dt>
                  <dd className="text-right">{pr.buildYear}</dd>
                  <dt className="text-muted">{tp("condition")}</dt>
                  <dd className="text-right">{tcond(pr.condition)}</dd>
                </dl>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{ta("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AssumptionsList codes={[...new Set(results.flatMap((r) => r.assumptions))]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{to("comments")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CommentsThread projectId={id} comments={comments} canComment={canComment} />
          </CardContent>
        </Card>
        <Disclaimer variant="long" />
      </div>
    </>
  );
}

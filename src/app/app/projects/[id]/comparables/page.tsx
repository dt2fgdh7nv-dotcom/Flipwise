import { CheckCircle2, CircleDashed } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AddComparableButton, ComparablesTable, ImportCsvButton, RefreshMarketButton } from "@/components/projects/comparables-manager";
import { MarketTrendChart } from "@/components/projects/market-trend-chart";
import { Disclaimer } from "@/components/shared/disclaimer";
import { SourceTag } from "@/components/shared/source-tag";
import { Stat } from "@/components/shared/stat";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatEur, formatPct } from "@/lib/format";
import { comparablesStats } from "@/lib/market/comparables-stats";
import { requireProjectAccess } from "@/server/authz";
import { getProjectBundle, listComparables } from "@/server/data/projects";
import { getMarketTrend, segmentFor } from "@/server/market/service";

export const metadata = { title: "Comparables & market" };

export default async function ComparablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "edit");
  const b = (await getProjectBundle(id))!;
  const pr = b.property!;
  const segment = segmentFor(pr.buildingType);
  const [comps, market] = await Promise.all([listComparables(b.organizationId, id), getMarketTrend(pr.postalCode, segment)]);
  const t = await getTranslations("comparables");
  const tm = await getTranslations("market");
  const sameType = comps.filter((c) => c.buildingType === pr.buildingType);
  const stats = comparablesStats(sameType, pr.livingAreaM2);
  const expected = b.deal?.scenarios.find((s) => s.kind === "expected");
  const expectedPerM2 = expected ? Math.round(expected.salePriceDebtFree / pr.livingAreaM2) : null;
  const sources = [...new Set(sameType.map((c) => c.source))];

  return (
    <div className="flex flex-col gap-6">
      {stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t("median")} value={formatEur(stats.medianPerM2)} hint={`${t("count", { count: stats.count })} · ${t("sameType")}`} />
          <Stat label={t("range")} value={`${formatEur(stats.minPerM2)}–${formatEur(stats.maxPerM2).replace("€", "")}`} />
          <Stat label={t("impliedValue")} value={formatEur(stats.impliedValue)} hint={t("impliedHint", { area: pr.livingAreaM2 })} />
          {expectedPerM2 ? (
            <Stat
              label={t("vsExpected")}
              value={`${formatEur(expectedPerM2)}/m²`}
              hint={t("vsMedian", { diff: `${expectedPerM2 >= stats.medianPerM2 ? "+" : ""}${formatPct(expectedPerM2 / stats.medianPerM2 - 1)}` })}
              tone={expectedPerM2 > stats.maxPerM2 ? "negative" : undefined}
            />
          ) : null}
          <div className="col-span-2 lg:col-span-4">
            {sources.map((s) => (
              <SourceTag key={s} source={s} className="mr-3" />
            ))}
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{tm("title")}</CardTitle>
            <CardDescription>{tm("subtitle", { postalCode: pr.postalCode, segment: tm(`segment.${segment}`) })}</CardDescription>
          </div>
          <RefreshMarketButton projectId={id} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {market.error === "unreachable" ? <Alert tone="warning">{tm("unreachable", { cached: market.trend ? "yes" : "no" })}</Alert> : null}
          {market.error === "no_data" && !market.trend ? <Alert tone="info">{tm("noData")}</Alert> : null}
          {market.trend && market.trend.points.length ? (
            <>
              <MarketTrendChart points={market.trend.points} referencePerM2={expectedPerM2} />
              <SourceTag source={`${market.trend.source}${market.trend.areaName ? ` — ${market.trend.areaName}` : ""}`} url={market.trend.sourceUrl} date={market.fetchedAt} />
              {market.fetchedAt ? <p className="text-xs text-muted">{tm("fetched", { date: formatDate(market.fetchedAt) })}</p> : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </div>
          <div className="flex gap-2">
            <ImportCsvButton projectId={id} />
            <AddComparableButton projectId={id} defaults={{ postalCode: pr.postalCode, municipality: pr.municipality, buildingType: pr.buildingType }} />
          </div>
        </CardHeader>
        <CardContent>
          <ComparablesTable projectId={id} rows={comps} editable />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tm("dataSources")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {[
              [tm("srcManual"), true, null],
              [tm("srcCsv"), true, null],
              [tm("srcStatfin"), true, null],
              [tm("srcLicensed"), false, tm("srcLicensedNote")],
            ].map(([label, on, note]) => (
              <li key={String(label)} className="flex items-start gap-2">
                {on ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <CircleDashed className="mt-0.5 size-4 text-muted" />}
                <div>
                  <p>
                    {label} <span className="text-xs text-muted">· {on ? tm("connected") : tm("notConnected")}</span>
                  </p>
                  {note ? <p className="text-xs text-muted">{note}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Disclaimer />
    </div>
  );
}

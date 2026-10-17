import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ProjectCard } from "@/components/projects/project-card";
import { Disclaimer } from "@/components/shared/disclaimer";
import { PageHeader } from "@/components/shared/page-header";
import { Stat } from "@/components/shared/stat";
import { PROJECT_STATUSES } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { taxRatesFromConfig } from "@/lib/config/resolve";
import { formatEur, formatPct } from "@/lib/format";
import { requireOrg } from "@/server/authz";
import { getEffectiveConfig } from "@/server/data/config";
import { analyzeListItem, listProjects } from "@/server/data/projects";

export const metadata = { title: "Dashboard" };

const CAPITAL_STATUSES = new Set(["purchased", "renovating", "listed"]);

export default async function DashboardPage() {
  const ctx = await requireOrg();
  const t = await getTranslations("dashboard");
  const ts = await getTranslations("status");
  const [projects, config] = await Promise.all([listProjects(ctx.org.id), getEffectiveConfig(ctx.org.id)]);
  const rates = taxRatesFromConfig(config);
  const rows = projects.map((p) => ({ p, ...analyzeListItem(p, ctx.org, rates) }));

  const active = rows.filter((r) => r.p.status !== "sold");
  const capital = rows.filter((r) => CAPITAL_STATUSES.has(r.p.status)).reduce((sum, r) => sum + (r.expected?.equityRequired ?? 0), 0);
  const expectedProfit = active.reduce((sum, r) => sum + (r.expected?.profitAfterTax ?? 0), 0);
  const sold = rows.filter((r) => r.p.status === "sold" && r.actual);
  const soldProfit = sold.reduce((s, r) => s + r.actual!.profitAfterTax, 0);
  const soldCost = sold.reduce((s, r) => s + r.actual!.totalCost, 0);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild>
            <Link href="/app/projects/new">
              <Plus /> {t("newProject")}
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("activeProjects")} value={active.length} />
        <Stat label={t("capitalTiedUp")} value={formatEur(capital)} hint={t("capitalHint")} />
        <Stat label={t("expectedProfit")} value={formatEur(expectedProfit)} hint={t("expectedProfitHint")} tone={expectedProfit < 0 ? "negative" : undefined} />
        <Stat label={t("portfolioRoi")} value={soldCost ? formatPct(soldProfit / soldCost) : "—"} hint={t("portfolioRoiHint")} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("pipeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {PROJECT_STATUSES.map((s) => (
              <Link key={s} href={`/app/projects?status=${s}`} className="rounded-lg border border-border px-3 py-2 hover:bg-surface-muted">
                <p className="text-xs text-muted">{ts(s)}</p>
                <p className="text-lg font-semibold tabular">{rows.filter((r) => r.p.status === s).length}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <h2 className="mb-3 mt-8 text-base font-semibold">{t("recent")}</h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.slice(0, 6).map(({ p, expected, actual }) => (
            <ProjectCard key={p.id} p={{ id: p.id, name: p.name, status: p.status, href: `/app/projects/${p.id}`, property: p.property, expected, actual }} />
          ))}
        </div>
      )}
      <Disclaimer className="mt-8" />
    </>
  );
}

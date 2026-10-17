import { LayoutGrid, List, Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ProjectCard } from "@/components/projects/project-card";
import { Disclaimer } from "@/components/shared/disclaimer";
import { PageHeader } from "@/components/shared/page-header";
import { PROJECT_STATUSES, StatusBadge, type ProjectStatus } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { taxRatesFromConfig } from "@/lib/config/resolve";
import { formatEur, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireOrg } from "@/server/authz";
import { getEffectiveConfig } from "@/server/data/config";
import { analyzeListItem, listProjects } from "@/server/data/projects";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string }> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "board";
  const statusFilter = PROJECT_STATUSES.includes(sp.status as ProjectStatus) ? (sp.status as ProjectStatus) : null;
  const t = await getTranslations("projects");
  const ts = await getTranslations("status");
  const [projects, config] = await Promise.all([listProjects(ctx.org.id), getEffectiveConfig(ctx.org.id)]);
  const rates = taxRatesFromConfig(config);
  const rows = projects
    .filter((p) => !statusFilter || p.status === statusFilter)
    .map((p) => {
      const a = analyzeListItem(p, ctx.org, rates);
      return { id: p.id, name: p.name, status: p.status, href: `/app/projects/${p.id}`, property: p.property, deal: p.deal, ...a };
    });
  const qs = (o: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const merged = { view, status: statusFilter, ...o };
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
    return `/app/projects?${params}`;
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <div className="flex rounded-lg border border-border bg-surface p-0.5">
              <Link href={qs({ view: "board" })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", view === "board" && "bg-surface-muted font-medium")}>
                <LayoutGrid className="size-4" /> {t("viewBoard")}
              </Link>
              <Link href={qs({ view: "list" })} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", view === "list" && "bg-surface-muted font-medium")}>
                <List className="size-4" /> {t("viewList")}
              </Link>
            </div>
            <Button asChild>
              <Link href="/app/projects/new">
                <Plus /> {t("new")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {[null, ...PROJECT_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={qs({ status: s })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-sm",
              statusFilter === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted",
            )}
          >
            {s ? ts(s) : t("all")}
          </Link>
        ))}
      </div>

      {view === "board" ? (
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {(statusFilter ? [statusFilter] : PROJECT_STATUSES).map((s) => {
            const col = rows.filter((r) => r.status === s);
            return (
              <section key={s} className="w-[85vw] shrink-0 snap-start sm:w-72">
                <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-medium">
                  {ts(s)} <span className="text-muted">{col.length}</span>
                </h2>
                <div className="flex min-h-24 flex-col gap-3 rounded-xl bg-surface-muted/60 p-2">
                  {col.length ? col.map((r) => <ProjectCard key={r.id} p={r} compact />) : <p className="p-3 text-xs text-muted">{t("empty")}</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>{t("colName")}</TH>
                <TH>{t("colStatus")}</TH>
                <TH className="text-right">{t("colArea")}</TH>
                <TH className="text-right">{t("colPrice")}</TH>
                <TH className="text-right">{t("colProfit")}</TH>
                <TH className="text-right">{t("colRoi")}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const res = r.actual ?? r.expected;
                return (
                  <TR key={r.id}>
                    <TD>
                      <Link href={r.href} className="font-medium hover:text-primary">
                        {r.name}
                      </Link>
                      <p className="text-xs text-muted">{r.property ? `${r.property.streetAddress}, ${r.property.municipality}` : ""}</p>
                    </TD>
                    <TD>
                      <StatusBadge status={r.status} />
                    </TD>
                    <TD className="text-right tabular">{r.property ? `${r.property.livingAreaM2} m²` : "—"}</TD>
                    <TD className="text-right tabular">{formatEur(r.deal?.askingPrice)}</TD>
                    <TD className={cn("text-right tabular", res && res.profitAfterTax < 0 && "text-danger")}>{formatEur(res?.profitAfterTax)}</TD>
                    <TD className="text-right tabular">{formatPct(res?.roi)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
      <Disclaimer className="mt-6" />
    </>
  );
}

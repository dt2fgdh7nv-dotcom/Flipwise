import { Building, Home } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { StatusBadge, type ProjectStatus } from "@/components/shared/status-badge";
import { formatEur, formatPct } from "@/lib/format";
import type { ScenarioResult } from "@/lib/finance/deal-engine";
import { cn } from "@/lib/utils";

export interface ProjectCardData {
  id: string;
  name: string;
  status: ProjectStatus;
  href: string;
  property: { streetAddress: string; unit: string | null; municipality: string; district: string | null; livingAreaM2: number; buildingType: string; layout: string | null } | null;
  expected: ScenarioResult | null;
  actual: ScenarioResult | null;
}

export function ProjectCard({ p, compact }: { p: ProjectCardData; compact?: boolean }) {
  const t = useTranslations("projects");
  const r = p.actual ?? p.expected;
  const Icon = p.property?.buildingType === "apartment" ? Building : Home;
  return (
    <Link href={p.href} className="group block rounded-[var(--radius-card)] border border-border bg-surface p-4 transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 rounded-lg bg-surface-muted p-2 text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium group-hover:text-primary">{p.name}</p>
            {p.property ? (
              <p className="truncate text-xs text-muted">
                {[p.property.district, p.property.municipality].filter(Boolean).join(", ")} · {p.property.livingAreaM2} m²{p.property.layout ? ` · ${p.property.layout}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        {!compact ? <StatusBadge status={p.status} /> : null}
      </div>
      {r ? (
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-muted">{p.actual ? t("actualProfit") : t("expectedProfit")}</dt>
            <dd className={cn("mt-0.5 font-semibold tabular", r.profitAfterTax < 0 ? "text-danger" : "text-foreground")}>{formatEur(r.profitAfterTax)}</dd>
          </div>
          <div>
            <dt className="text-muted">ROI</dt>
            <dd className="mt-0.5 font-semibold tabular">{formatPct(r.roi)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t("salePrice")}</dt>
            <dd className="mt-0.5 font-semibold tabular">{formatEur(r.selling.salePriceDebtFree)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-xs text-muted">{t("noDeal")}</p>
      )}
    </Link>
  );
}

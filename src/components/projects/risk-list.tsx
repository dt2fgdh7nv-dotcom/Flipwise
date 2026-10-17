"use client";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { SourceTag } from "@/components/shared/source-tag";
import { Badge } from "@/components/ui/badge";
import { formatBps, formatEur } from "@/lib/format";
import type { RiskFlag } from "@/lib/risk/risk-rules";
import { cn } from "@/lib/utils";

const ICON = { high: OctagonAlert, medium: AlertTriangle, info: Info };
const TONE = { high: "danger", medium: "warning", info: "info" } as const;

export function RiskList({ flags, manual = [] }: { flags: RiskFlag[]; manual?: { id: string; title: string; detail: string | null; severity: "high" | "medium" | "info" }[] }) {
  const t = useTranslations("risks");
  const ts = useTranslations("severity");
  const tk = useTranslations("maintenanceKind");
  const tst = useTranslations("maintenanceStatus");

  const params = (f: RiskFlag) => {
    const p = f.params;
    return {
      ...p,
      kind: p.kind ? tk(String(p.kind) as never) : "",
      status: p.status ? tst(String(p.status) as never) : "",
      estimatedShare: p.estimatedShare === "" || p.estimatedShare === undefined ? "empty" : formatEur(Number(p.estimatedShare)),
      amount: p.amount !== undefined ? formatEur(Number(p.amount)) : "",
      ratio: p.ratioBps !== undefined ? formatBps(Number(p.ratioBps), 1) : "",
      limit: p.limitBps !== undefined ? formatBps(Number(p.limitBps), 1) : "",
    };
  };

  if (flags.length === 0 && manual.length === 0) return <p className="text-sm text-muted">{t("none")}</p>;

  return (
    <ul className="flex flex-col gap-3">
      {manual.map((m) => {
        const Icon = ICON[m.severity];
        return (
          <li key={m.id} className="flex gap-3">
            <Icon className={cn("mt-0.5 size-4 shrink-0", m.severity === "high" ? "text-danger" : m.severity === "medium" ? "text-warning" : "text-info")} />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {m.title} <Badge tone={TONE[m.severity]}>{ts(m.severity)}</Badge>
              </p>
              {m.detail ? <p className="mt-0.5 text-sm text-muted">{m.detail}</p> : null}
            </div>
          </li>
        );
      })}
      {flags.map((f, i) => {
        const Icon = ICON[f.severity];
        const p = params(f);
        return (
          <li key={`${f.code}-${i}`} className="flex gap-3">
            <Icon className={cn("mt-0.5 size-4 shrink-0", f.severity === "high" ? "text-danger" : f.severity === "medium" ? "text-warning" : "text-info")} />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {t(`${f.code}.title`, p)} <Badge tone={TONE[f.severity]}>{ts(f.severity)}</Badge>
              </p>
              <p className="mt-0.5 text-sm text-muted">{t(`${f.code}.detail`, p)}</p>
              <SourceTag className="mt-1" source={f.basis.label} url={f.basis.url} date={f.basis.date} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

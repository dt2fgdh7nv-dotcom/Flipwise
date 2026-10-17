"use client";
import { useTranslations } from "next-intl";
import { Term } from "@/components/shared/term";
import { formatBps, formatEur, formatPct } from "@/lib/format";
import type { ScenarioResult } from "@/lib/finance/deal-engine";
import { cn } from "@/lib/utils";

type Col = { key: string; label: string; r: ScenarioResult; emphasis?: boolean };
type Row =
  | { group: string }
  | { label: React.ReactNode; get: (r: ScenarioResult) => number | null; fmt?: "eur" | "pct"; strong?: boolean; signed?: boolean; hideIfZero?: boolean };

/** Side-by-side scenario comparison. Used by flipper workspace, client portal and (later) PDF. */
export function DealResultsTable({ results, actual, compact }: { results: ScenarioResult[]; actual?: ScenarioResult | null; compact?: boolean }) {
  const t = useTranslations("deal");
  const tl = useTranslations("deal.line");
  const tg = useTranslations("deal.groups");
  const ts = useTranslations("scenario");
  const cols: Col[] = results.map((r) => ({ key: r.kind, label: ts(r.kind), r, emphasis: r.kind === "expected" }));
  if (actual) cols.push({ key: "actual", label: t("actual"), r: actual, emphasis: true });
  if (!cols.length) return null;
  const ref = cols[0].r;

  const rows: Row[] = [
    { group: tg("acquisition") },
    { label: tl("purchasePrice"), get: (r) => r.acquisition.purchasePrice },
    { label: <Term k="velkaosuus" />, get: (r) => r.acquisition.debtShare, hideIfZero: true },
    { label: tl("transferTax", { rate: formatBps(ref.acquisition.transferTaxRateBps) }), get: (r) => r.acquisition.transferTax },
    { label: tl("otherAcquisition"), get: (r) => r.acquisition.otherCosts, hideIfZero: true },
    { label: tl("acquisitionTotal"), get: (r) => r.acquisition.total, strong: true },
    { group: tg("renovation") },
    { label: tl("renovation"), get: (r) => r.renovation.budgetExclVat },
    { label: tl("contingency"), get: (r) => r.renovation.contingency, hideIfZero: true },
    { label: tl("renovationVat"), get: (r) => r.renovation.vat, hideIfZero: true },
    { label: tl("renovationTotal"), get: (r) => r.renovation.total, strong: true },
    { group: tg("holding") },
    { label: <Term k="hoitovastike">{tl("maintenance")}</Term>, get: (r) => r.holding.maintenanceFees },
    { label: <Term k="rahoitusvastike">{tl("financing")}</Term>, get: (r) => r.holding.financingFees, hideIfZero: true },
    { label: tl("utilities"), get: (r) => r.holding.utilities },
    { label: tl("interest"), get: (r) => r.holding.loanInterest, hideIfZero: true },
    { label: tl("loanFee"), get: (r) => r.holding.loanArrangementFee, hideIfZero: true },
    { label: tl("holdingTotal"), get: (r) => r.holding.total, strong: true },
    { group: tg("selling") },
    { label: tl("agentFee"), get: (r) => r.selling.agentFee },
    { label: tl("agentVat"), get: (r) => r.selling.agentFeeVat, hideIfZero: true },
    { label: tl("otherSelling"), get: (r) => r.selling.otherCosts, hideIfZero: true },
    { label: tl("sellingTotal"), get: (r) => r.selling.total, strong: true },
    { group: tg("returns") },
    { label: tl("totalCost"), get: (r) => r.totalCost, strong: true },
    { label: tl("salePrice"), get: (r) => r.selling.salePriceDebtFree, strong: true },
    { label: tl("profitBeforeTax"), get: (r) => r.profitBeforeTax, signed: true },
    { label: tl("tax"), get: (r) => r.tax },
    { label: tl("profitAfterTax"), get: (r) => r.profitAfterTax, strong: true, signed: true },
    { label: tl("roi"), get: (r) => r.roi, fmt: "pct", signed: true },
    { label: tl("annualizedRoi"), get: (r) => r.annualizedRoi, fmt: "pct", signed: true },
    { label: tl("roe"), get: (r) => r.returnOnEquity, fmt: "pct", signed: true },
    { label: tl("equity"), get: (r) => r.equityRequired },
    { label: tl("breakEven"), get: (r) => r.breakEvenSalePrice, strong: true },
    { label: tl("perM2Purchase"), get: (r) => r.perM2.purchaseDebtFree },
    { label: tl("perM2Sale"), get: (r) => r.perM2.sale },
    { label: tl("perM2BreakEven"), get: (r) => r.perM2.breakEven },
  ];

  const visible = rows.filter((row) => !("get" in row) || !row.hideIfZero || cols.some((c) => row.get(c.r)));

  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-sm tabular", compact && "text-xs")}>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="sticky left-0 z-10 bg-surface py-2 pr-2 font-medium" />
            {cols.map((c) => (
              <th key={c.key} className={cn("px-2 py-2 text-right font-medium", c.emphasis && "text-foreground")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) =>
            "group" in row ? (
              <tr key={i}>
                <td colSpan={cols.length + 1} className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-primary">
                  {row.group}
                </td>
              </tr>
            ) : (
              <tr key={i} className={cn("border-t border-border/70", row.strong && "font-semibold")}>
                <td className="sticky left-0 z-10 min-w-32 bg-surface py-1.5 pr-2 text-left font-normal text-muted">{row.label}</td>
                {cols.map((c) => {
                  const v = row.get(c.r);
                  const neg = row.signed && v !== null && v < 0;
                  return (
                    <td key={c.key} className={cn("whitespace-nowrap px-2 py-1.5 text-right", c.emphasis && "bg-surface-muted/50", neg && "text-danger", row.signed && v !== null && v > 0 && row.strong && "text-success")}>
                      {row.fmt === "pct" ? formatPct(v) : formatEur(v)}
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

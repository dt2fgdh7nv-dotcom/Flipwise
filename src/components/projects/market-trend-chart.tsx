"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatEur, formatNumber } from "@/lib/format";

const SERIES = "#2a78d6"; // validated categorical slot 1 (dataviz palette)
const GRID = "#e8e6e0";
const TEXT_MUTED = "#5d6763";

export interface TrendPoint {
  period: string;
  pricePerM2: number | null;
  transactions: number | null;
}

export function MarketTrendChart({ points, referencePerM2 }: { points: TrendPoint[]; referencePerM2: number | null }) {
  const t = useTranslations("market");
  const [showTable, setShowTable] = useState(false);
  const data = points.map((p) => ({ ...p, eur: p.pricePerM2 === null ? null : p.pricePerM2 / 100 }));
  const compact = (v: number) => `€${(v / 1000).toFixed(1)}K`;

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: TEXT_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: TEXT_MUTED }} tickLine={false} axisLine={false} width={52} tickFormatter={compact} domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: TEXT_MUTED, strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md">
                    <p className="text-muted">{label}</p>
                    <p className="mt-0.5 flex items-center gap-2">
                      <span className="inline-block h-0.5 w-3" style={{ background: SERIES }} />
                      <span className="font-semibold tabular">{p.pricePerM2 === null ? "—" : `${formatEur(p.pricePerM2)}/m²`}</span>
                    </p>
                    {p.transactions !== null ? (
                      <p className="mt-0.5 text-muted">
                        {t("transactions")}: {formatNumber(p.transactions)}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
            {referencePerM2 ? (
              <ReferenceLine y={referencePerM2 / 100} stroke={TEXT_MUTED} strokeWidth={1} label={{ value: `${t("yourSale")} ${formatEur(referencePerM2)}/m²`, position: "insideTopRight", fontSize: 11, fill: TEXT_MUTED }} />
            ) : null}
            <Line type="monotone" dataKey="eur" stroke={SERIES} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" connectNulls dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Button variant="link" size="sm" onClick={() => setShowTable(!showTable)}>
        {showTable ? t("hideTable") : t("showTable")}
      </Button>
      {showTable ? (
        <Table className="text-xs">
          <THead>
            <TR>
              <TH>{t("period")}</TH>
              <TH className="text-right">€/m²</TH>
              <TH className="text-right">{t("transactions")}</TH>
            </TR>
          </THead>
          <TBody>
            {[...points].reverse().map((p) => (
              <TR key={p.period}>
                <TD>{p.period}</TD>
                <TD className="text-right tabular">{formatEur(p.pricePerM2)}</TD>
                <TD className="text-right tabular">{formatNumber(p.transactions)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : null}
    </div>
  );
}

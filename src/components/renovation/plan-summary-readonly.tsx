import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { formatEur } from "@/lib/format";
import type { Totals } from "@/lib/renovation/estimate";
import type { PlanRoomView } from "./plan-builder";

/** Client-facing plan summary: rooms, items and totals (no unit prices). */
export async function PlanSummaryReadOnly({ rooms, byRoom, total, vatFactor, vatLabel }: { rooms: PlanRoomView[]; byRoom: Record<string, Totals>; total: Totals; vatFactor: number; vatLabel: string }) {
  const t = await getTranslations("renovation");
  const tr = await getTranslations("roomType");
  const tcert = await getTranslations("certification");
  const show = (c: number) => formatEur(Math.round(c * vatFactor));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <span className="text-lg font-semibold tabular">{show(total.total)}</span>{" "}
        <span className="text-muted">
          · {t("range", { low: show(total.low), high: show(total.high) })} · {vatLabel}
        </span>
      </p>
      <ul className="divide-y divide-border">
        {rooms.map((r) => (
          <li key={r.id} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">
                {r.name} <span className="text-xs font-normal text-muted">{tr(r.roomType)}</span>
              </p>
              <p className="tabular">{show(byRoom[r.id].total)}</p>
            </div>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {r.lines.map((l) => (
                <li key={l.id}>
                  <Badge tone={l.certification ? "warning" : "neutral"} title={l.certification ? tcert(`${l.certification}.label`) : undefined}>
                    {l.name}
                  </Badge>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

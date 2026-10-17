/** Renovation plan maths. Cents, excl. VAT. Pure — shared by server, client and (later) the PDF report. */
import type { Certification, QualityTier } from "@/lib/costs/seed-catalogue";

export interface TierPrices {
  budgetLow: number;
  budgetHigh: number;
  midLow: number;
  midHigh: number;
  premiumLow: number;
  premiumHigh: number;
}

/** Low/high range and the typical (midpoint) price for a tier. */
export function tierPrice(item: TierPrices, tier: QualityTier) {
  const low = item[`${tier}Low`];
  const high = item[`${tier}High`];
  return { low, high, typical: Math.round((low + high) / 2) };
}

export interface PricedLine {
  quantity: number;
  unitPrice: number;
  unitPriceLow: number;
  unitPriceHigh: number;
  laborBps: number;
  certification: Certification | null;
  needsRenovationNotice: boolean;
}

export function lineTotals(l: PricedLine) {
  const total = Math.round(l.quantity * l.unitPrice);
  const labor = Math.round((total * l.laborBps) / 10_000);
  return {
    total,
    low: Math.round(l.quantity * l.unitPriceLow),
    high: Math.round(l.quantity * l.unitPriceHigh),
    labor,
    materials: total - labor,
  };
}

export type Totals = ReturnType<typeof lineTotals>;
const zero = (): Totals => ({ total: 0, low: 0, high: 0, labor: 0, materials: 0 });
const add = (a: Totals, b: Totals): Totals => ({
  total: a.total + b.total,
  low: a.low + b.low,
  high: a.high + b.high,
  labor: a.labor + b.labor,
  materials: a.materials + b.materials,
});

export function planTotals<L extends PricedLine>(rooms: { id: string; lines: L[] }[]) {
  const byRoom: Record<string, Totals> = {};
  let plan = zero();
  const certifications = new Set<Certification>();
  let noticeLines = 0;
  for (const room of rooms) {
    let rt = zero();
    for (const l of room.lines) {
      rt = add(rt, lineTotals(l));
      if (l.certification) certifications.add(l.certification);
      if (l.needsRenovationNotice) noticeLines += 1;
    }
    byRoom[room.id] = rt;
    plan = add(plan, rt);
  }
  return { byRoom, plan, certifications: [...certifications].sort(), noticeLines };
}

/** Scenario budgets derived from the plan: best = low end, expected = typical, worst = high end. */
export function scenarioBudgetsFromPlan(plan: Totals) {
  return { best: plan.low, expected: plan.total, worst: plan.high };
}

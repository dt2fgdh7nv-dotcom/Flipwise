import "server-only";
import type { CostItemView } from "@/components/costs/cost-database";
import type { CatalogueItem } from "./costs";

export function toCostItemView(i: CatalogueItem): CostItemView {
  return {
    id: i.id,
    platformItemId: i.scope === "override" ? i.baseItemId : i.scope === "platform" ? i.id : null,
    scope: i.scope,
    code: i.code,
    category: i.category,
    nameEn: i.nameEn,
    nameFi: i.nameFi,
    unit: i.unit,
    budgetLow: i.budgetLow,
    budgetHigh: i.budgetHigh,
    midLow: i.midLow,
    midHigh: i.midHigh,
    premiumLow: i.premiumLow,
    premiumHigh: i.premiumHigh,
    laborBps: i.laborBps,
    certification: i.certification,
    needsRenovationNotice: i.needsRenovationNotice,
    priceDate: i.priceDate,
    source: i.source,
    sourceUrl: i.sourceUrl,
    notes: i.notes,
    active: i.active,
  };
}

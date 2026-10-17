import { getTranslations } from "next-intl/server";
import { CostDatabase } from "@/components/costs/cost-database";
import { PageHeader } from "@/components/shared/page-header";
import { toCostItemView } from "@/server/data/cost-views";
import { getEffectiveCatalogue } from "@/server/data/costs";
import { getEffectiveConfig, todayInHelsinki } from "@/server/data/config";

export const metadata = { title: "Platform cost database" };

export default async function AdminCostsPage() {
  const t = await getTranslations("costs");
  const [catalogue, config] = await Promise.all([getEffectiveCatalogue(null, { includeInactive: true }), getEffectiveConfig(null)]);
  return (
    <>
      <PageHeader title={t("platformTitle")} description={t("platformSubtitle")} />
      <CostDatabase items={catalogue.map(toCostItemView)} mode="platform" canEdit vatBps={config["tax.vat.general"].value} today={todayInHelsinki()} />
    </>
  );
}

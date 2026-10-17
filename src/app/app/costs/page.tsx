import { getTranslations } from "next-intl/server";
import { CostDatabase } from "@/components/costs/cost-database";
import { Disclaimer } from "@/components/shared/disclaimer";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { hasRole, requireOrg } from "@/server/authz";
import { toCostItemView } from "@/server/data/cost-views";
import { getEffectiveCatalogue } from "@/server/data/costs";
import { getEffectiveConfig, todayInHelsinki } from "@/server/data/config";

export const metadata = { title: "Cost database" };

export default async function CostsPage() {
  const ctx = await requireOrg();
  const t = await getTranslations("costs");
  const [catalogue, config] = await Promise.all([getEffectiveCatalogue(ctx.org.id), getEffectiveConfig(ctx.org.id)]);
  const canEdit = hasRole(ctx, "admin");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="flex flex-col gap-4">
        <Disclaimer />
        {!canEdit ? <Alert tone="info">{t("adminOnly")}</Alert> : null}
        <CostDatabase items={catalogue.map(toCostItemView)} mode="org" canEdit={canEdit} vatDisplay={ctx.org.vatDisplay} vatBps={config["tax.vat.general"].value} today={todayInHelsinki()} />
      </div>
    </>
  );
}

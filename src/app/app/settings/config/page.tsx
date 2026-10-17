import { getTranslations } from "next-intl/server";
import { ConfigTable } from "@/components/settings/config-table";
import { Disclaimer } from "@/components/shared/disclaimer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONFIG_DEFINITIONS } from "@/lib/config/definitions";
import { hasRole, requireOrg } from "@/server/authz";
import { getEffectiveConfig, loadConfigRows, todayInHelsinki } from "@/server/data/config";

export const metadata = { title: "Rates & assumptions" };

export default async function ConfigSettingsPage() {
  const ctx = await requireOrg();
  const t = await getTranslations("settings");
  const [config, rows] = await Promise.all([getEffectiveConfig(ctx.org.id), loadConfigRows(ctx.org.id)]);
  const view = CONFIG_DEFINITIONS.map((d) => {
    const c = config[d.key];
    return { ...c, group: d.group, hasOverride: rows.some((r) => r.key === d.key && r.organizationId === ctx.org.id) };
  });
  return (
    <div className="flex flex-col gap-6">
      <Disclaimer variant="long" />
      <Card>
        <CardHeader>
          <CardTitle>{t("config")}</CardTitle>
          <CardDescription>{t("configHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigTable rows={view} mode="org" canEdit={hasRole(ctx, "admin")} today={todayInHelsinki()} />
        </CardContent>
      </Card>
    </div>
  );
}

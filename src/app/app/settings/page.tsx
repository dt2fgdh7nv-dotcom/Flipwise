import { getTranslations } from "next-intl/server";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasRole, requireOrg } from "@/server/authz";

export const metadata = { title: "Settings" };

export default async function WorkspaceSettingsPage() {
  const ctx = await requireOrg();
  const t = await getTranslations("settings");
  const editable = hasRole(ctx, "admin");
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t("workspace")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!editable ? <Alert tone="info">{t("adminOnly")}</Alert> : null}
          <WorkspaceForm editable={editable} initial={{ name: ctx.org.name, defaultTaxProfile: ctx.org.defaultTaxProfile, vatDisplay: ctx.org.vatDisplay, vatDeductible: ctx.org.vatDeductible }} />
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t("plan")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Badge tone="primary" className="uppercase">
            {ctx.org.planTier}
          </Badge>
          <p className="mt-2 text-muted">{t("planHint", { plan: ctx.org.planTier })}</p>
        </CardContent>
      </Card>
    </div>
  );
}

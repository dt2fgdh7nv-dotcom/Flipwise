import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/server/authz";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const ctx = await requireOrg();
  const t = await getTranslations("settings");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="font-medium">{ctx.user.name}</p>
          <p className="text-muted">{ctx.user.email}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> {t("gdpr")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">{t("gdprBody")}</CardContent>
      </Card>
    </div>
  );
}

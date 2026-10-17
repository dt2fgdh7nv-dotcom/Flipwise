import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrgContext, requireUser } from "@/server/authz";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  await requireUser();
  if (await getOrgContext()) redirect("/app");
  const t = await getTranslations("auth");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("onboardingTitle")}</CardTitle>
        <CardDescription>{t("onboardingSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <OnboardingForm />
      </CardContent>
    </Card>
  );
}

import { getTranslations } from "next-intl/server";
import { SettingsNav } from "@/components/settings/settings-nav";
import { PageHeader } from "@/components/shared/page-header";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("settings");
  return (
    <>
      <PageHeader title={t("title")} />
      <SettingsNav />
      <div className="mt-6">{children}</div>
    </>
  );
}

import { getTranslations } from "next-intl/server";
import { Disclaimer } from "@/components/shared/disclaimer";
import { PageHeader } from "@/components/shared/page-header";
import { requireOrg } from "@/server/authz";
import { NewProjectForm } from "./new-project-form";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requireOrg();
  const t = await getTranslations("newProject");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <NewProjectForm />
      <Disclaimer className="mt-6" />
    </div>
  );
}

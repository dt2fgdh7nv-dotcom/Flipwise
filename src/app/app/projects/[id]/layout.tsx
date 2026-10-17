import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { StatusSelect } from "@/components/projects/status-select";
import { requireProjectAccess } from "@/server/authz";
import { getProjectBundle } from "@/server/data/projects";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id, "view");
  if (access.kind !== "member") redirect(`/portal/projects/${id}`);
  const bundle = (await getProjectBundle(id))!;
  const t = await getTranslations("projects");
  const pr = bundle.property;
  return (
    <>
      <Link href="/app/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="size-4" /> {t("title")}
      </Link>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{bundle.name}</h1>
          {pr ? (
            <p className="mt-1 text-sm text-muted">
              {[pr.streetAddress, pr.unit].filter(Boolean).join(" ")}, {pr.postalCode} {pr.municipality}
              {pr.district ? ` (${pr.district})` : ""} · {pr.livingAreaM2} m² · {pr.buildYear}
            </p>
          ) : null}
        </div>
        <StatusSelect projectId={id} status={bundle.status} />
      </div>
      <ProjectTabs projectId={id} />
      <div className="mt-6">{children}</div>
    </>
  );
}

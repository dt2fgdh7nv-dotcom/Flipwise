import { Building, Home } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { getOrgContext, requireUser } from "@/server/authz";
import { listSharedProjects } from "@/server/data/portal";

export const metadata = { title: "Shared with me" };

export default async function PortalPage() {
  const user = await requireUser();
  const [projects, ctx] = await Promise.all([listSharedProjects(user.id), getOrgContext()]);
  const t = await getTranslations("portal");
  const tr = await getTranslations("roles");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {projects.length === 0 ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{t("empty")}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => {
          const Icon = p.buildingType === "apartment" ? Building : Home;
          return (
            <Link key={p.id} href={`/portal/projects/${p.id}`} className="rounded-[var(--radius-card)] border border-border bg-surface p-4 transition hover:border-primary/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <span className="rounded-lg bg-surface-muted p-2 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[p.district, p.municipality].filter(Boolean).join(", ")} · {p.livingAreaM2} m²
                    </p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                {t("sharedBy", { org: p.orgName })} <Badge>{tr(p.role)}</Badge>
              </p>
            </Link>
          );
        })}
      </div>
      {!ctx ? (
        <p className="mt-10 text-center text-sm">
          <Link href="/onboarding" className="text-primary hover:underline">
            {t("createWorkspace")}
          </Link>
        </p>
      ) : null}
    </>
  );
}

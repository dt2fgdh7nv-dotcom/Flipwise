import { count, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ConfigTable } from "@/components/settings/config-table";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { db } from "@/db";
import { configValue, member, organization, project } from "@/db/schema";
import { CONFIG_DEFINITIONS } from "@/lib/config/definitions";
import { requireUser } from "@/server/authz";
import { getEffectiveConfig, todayInHelsinki } from "@/server/data/config";

export const metadata = { title: "Platform admin" };

export default async function AdminPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) notFound();
  const t = await getTranslations("admin");
  const [config, rows, orgs, projectCounts, memberCounts] = await Promise.all([
    getEffectiveConfig(null),
    db.select().from(configValue).where(isNull(configValue.organizationId)),
    db.select().from(organization).orderBy(organization.createdAt),
    db.select({ orgId: project.organizationId, n: count() }).from(project).groupBy(project.organizationId),
    db.select({ orgId: member.organizationId, n: count() }).from(member).groupBy(member.organizationId),
  ]);
  const view = CONFIG_DEFINITIONS.map((d) => ({
    ...config[d.key],
    group: d.group,
    hasOverride: false,
    history: rows
      .filter((r) => r.key === d.key)
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
      .map((r) => ({ id: r.id, value: Number(r.value), validFrom: r.validFrom, source: r.source, updatedAt: r.updatedAt })),
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="pt-5">
            <ConfigTable rows={view} mode="platform" canEdit today={todayInHelsinki()} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("tenants")}</CardTitle>
            <CardDescription>{t("tenantsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Plan</TH>
                  <TH className="text-right">{t("membersCount")}</TH>
                  <TH className="text-right">{t("projects")}</TH>
                </TR>
              </THead>
              <TBody>
                {orgs.map((o) => (
                  <TR key={o.id}>
                    <TD>{o.name}</TD>
                    <TD>
                      <Badge>{o.planTier}</Badge>
                    </TD>
                    <TD className="text-right tabular">{memberCounts.find((m) => m.orgId === o.id)?.n ?? 0}</TD>
                    <TD className="text-right tabular">{projectCounts.find((p) => p.orgId === o.id)?.n ?? 0}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

import { getTranslations } from "next-intl/server";
import { HousingCompanyForm } from "@/components/projects/housing-company-form";
import { MaintenanceItems } from "@/components/projects/maintenance-items";
import { RiskList } from "@/components/projects/risk-list";
import { Disclaimer } from "@/components/shared/disclaimer";
import { Term } from "@/components/shared/term";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProjectAccess } from "@/server/authz";
import { analyzeProject, getProjectBundle } from "@/server/data/projects";

export const metadata = { title: "Housing company" };

const HC_RISKS = new Set(["pts_major_upcoming", "pts_upcoming", "pipe_renovation_overdue", "missing_manager_certificate", "missing_maintenance_plan", "renovation_notice_required", "asbestos_survey", "high_debt_share"]);

export default async function HousingCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "edit");
  const b = (await getProjectBundle(id))!;
  const t = await getTranslations("housingCompany");
  const tr = await getTranslations("risks");
  if (b.property?.ownershipForm !== "housing_company_share") return <Alert tone="info">{t("notApplicable")}</Alert>;
  const { risks } = await analyzeProject(b);
  const hc = b.housingCompany;
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>
            <Term k="taloyhtio">{t("title")}</Term>
          </CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <HousingCompanyForm
            projectId={id}
            initial={{
              name: hc?.name ?? null,
              businessId: hc?.businessId ?? null,
              managerName: hc?.managerName ?? null,
              managerEmail: hc?.managerEmail ?? null,
              managerPhone: hc?.managerPhone ?? null,
              unitsTotal: hc?.unitsTotal ?? null,
              lastPipeRenovationYear: hc?.lastPipeRenovationYear ?? null,
              lastFacadeRenovationYear: hc?.lastFacadeRenovationYear ?? null,
              lastRoofRenovationYear: hc?.lastRoofRenovationYear ?? null,
              managerCertificateDate: hc?.managerCertificateDate ?? null,
              maintenancePlanDate: hc?.maintenancePlanDate ?? null,
              renovationNoticeNotes: hc?.renovationNoticeNotes ?? null,
              notes: hc?.notes ?? null,
            }}
          />
        </CardContent>
      </Card>
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <Term k="pts">{t("pts")}</Term>
            </CardTitle>
            <CardDescription>{t("ptsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <MaintenanceItems projectId={id} items={hc?.maintenance ?? []} areaM2={b.property.livingAreaM2} editable />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{tr("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskList flags={risks.filter((r) => HC_RISKS.has(r.code))} />
          </CardContent>
        </Card>
      </div>
      <Disclaimer className="lg:col-span-5" />
    </div>
  );
}

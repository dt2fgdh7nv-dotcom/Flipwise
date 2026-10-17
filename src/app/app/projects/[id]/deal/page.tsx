import { getTranslations } from "next-intl/server";
import { DealWorkspace } from "@/components/projects/deal-workspace";
import { Disclaimer } from "@/components/shared/disclaimer";
import { requireProjectAccess } from "@/server/authz";
import { getEffectiveConfig } from "@/server/data/config";
import { getProjectBundle, scenarioInputsFrom } from "@/server/data/projects";

export const metadata = { title: "Deal analysis" };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "edit");
  const b = (await getProjectBundle(id))!;
  const t = await getTranslations("deal");
  if (!b.property || !b.deal) return <p className="text-sm text-muted">{t("noDeal")}</p>;
  const config = await getEffectiveConfig(b.organizationId);
  const d = b.deal;
  const showActuals = ["purchased", "renovating", "listed", "sold"].includes(b.status) || Boolean(d.actualSalePrice);
  return (
    <>
      <DealWorkspace
        projectId={id}
        showActuals={showActuals}
        property={{ ownershipForm: b.property.ownershipForm, livingAreaM2: b.property.livingAreaM2, buildYear: b.property.buildYear, plotType: b.property.plotType }}
        housingCompany={b.housingCompany ?? null}
        maintenance={b.housingCompany?.maintenance ?? []}
        manualRisks={b.manualRisks.map((m) => ({ id: m.id, title: m.title, detail: m.detail, severity: m.severity }))}
        org={{ vatDeductible: b.org.vatDeductible, vatDisplay: b.org.vatDisplay }}
        config={config}
        deal={{
          askingPrice: d.askingPrice,
          offerPrice: d.offerPrice,
          debtShare: d.debtShare,
          maintenanceFeeMonthly: d.maintenanceFeeMonthly,
          financingFeeMonthly: d.financingFeeMonthly,
          utilitiesMonthly: d.utilitiesMonthly,
          otherAcquisitionCosts: d.otherAcquisitionCosts,
          otherSellingCosts: d.otherSellingCosts,
          agentFeeBps: d.agentFeeBps,
          loanToValueBps: d.loanToValueBps,
          loanArrangementFee: d.loanArrangementFee,
          taxProfile: d.taxProfile,
          actualPurchasePrice: d.actualPurchasePrice,
          actualRenovationCost: d.actualRenovationCost,
          actualHoldingMonths: d.actualHoldingMonths === null ? null : Number(d.actualHoldingMonths),
          actualSalePrice: d.actualSalePrice,
          notes: d.notes,
          scenarios: scenarioInputsFrom(d),
        }}
      />
      <Disclaimer variant="long" className="mt-6" />
    </>
  );
}

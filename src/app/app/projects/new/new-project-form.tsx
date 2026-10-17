"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { emptyProperty, PropertyFields, toPropertyPayload, type FieldErrors } from "@/components/projects/property-fields";
import { Term } from "@/components/shared/term";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, UnitInput } from "@/components/ui/input";
import { parseEurToCents } from "@/lib/format";
import { createProject } from "../actions";

export function NewProjectForm() {
  const t = useTranslations("newProject");
  const tp = useTranslations("property");
  const td = useTranslations("deal");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [prop, setProp] = useState(emptyProperty);
  const [money, setMoney] = useState({ askingPrice: "", debtShare: "0", maintenanceFeeMonthly: "", financingFeeMonthly: "0", expectedSalePrice: "", renovationBudget: "", holdingMonths: "5" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const isShare = prop.ownershipForm === "housing_company_share";
  const setM = (k: keyof typeof money) => (e: React.ChangeEvent<HTMLInputElement>) => setMoney({ ...money, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: name || null,
      property: toPropertyPayload(prop),
      askingPrice: parseEurToCents(money.askingPrice),
      debtShare: parseEurToCents(money.debtShare) ?? 0,
      maintenanceFeeMonthly: parseEurToCents(money.maintenanceFeeMonthly) ?? 0,
      financingFeeMonthly: parseEurToCents(money.financingFeeMonthly) ?? 0,
      expectedSalePrice: parseEurToCents(money.expectedSalePrice),
      renovationBudget: parseEurToCents(money.renovationBudget) ?? 0,
      holdingMonths: Number(money.holdingMonths.replace(",", ".")),
    };
    start(async () => {
      const res = await createProject(payload);
      if (!res.ok) {
        setError(res.error);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      toast.success(t("create"));
      router.push(`/app/projects/${res.data!.id}/deal`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("sectionProperty")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label={tp("name")} hint={tp("nameHint")} htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <PropertyFields value={prop} onChange={setProp} errors={errors} prefix="property." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionDeal")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={<>{td("askingPrice")} · <Term k="myyntihinta" /></>} hint={td("askingPriceHint")} error={errors.askingPrice} htmlFor="askingPrice">
            <UnitInput unit="€" id="askingPrice" required value={money.askingPrice} onChange={setM("askingPrice")} />
          </Field>
          {isShare ? (
            <Field label={<>{td("debtShare")} · <Term k="velkaosuus" /></>} error={errors.debtShare} htmlFor="debtShare">
              <UnitInput unit="€" id="debtShare" value={money.debtShare} onChange={setM("debtShare")} />
            </Field>
          ) : null}
          <Field label={<>{td("maintenanceFee")} · <Term k="hoitovastike" /></>} error={errors.maintenanceFeeMonthly} htmlFor="maintenanceFeeMonthly">
            <UnitInput unit="€/mo" id="maintenanceFeeMonthly" value={money.maintenanceFeeMonthly} onChange={setM("maintenanceFeeMonthly")} />
          </Field>
          {isShare ? (
            <Field label={<>{td("financingFee")} · <Term k="rahoitusvastike" /></>} error={errors.financingFeeMonthly} htmlFor="financingFeeMonthly">
              <UnitInput unit="€/mo" id="financingFeeMonthly" value={money.financingFeeMonthly} onChange={setM("financingFeeMonthly")} />
            </Field>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionPlan")}</CardTitle>
          <CardDescription>{t("planHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label={<>{td("salePrice")} · <Term k="velatonHinta" /></>} error={errors.expectedSalePrice} htmlFor="expectedSalePrice">
            <UnitInput unit="€" id="expectedSalePrice" required value={money.expectedSalePrice} onChange={setM("expectedSalePrice")} />
          </Field>
          <Field label={td("renovationBudget")} hint={td("renovationHintExcl")} error={errors.renovationBudget} htmlFor="renovationBudget">
            <UnitInput unit="€" id="renovationBudget" value={money.renovationBudget} onChange={setM("renovationBudget")} />
          </Field>
          <Field label={td("holdingMonths")} error={errors.holdingMonths} htmlFor="holdingMonths">
            <UnitInput unit="mo" id="holdingMonths" value={money.holdingMonths} onChange={setM("holdingMonths")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "…" : t("create")}
        </Button>
      </div>
    </form>
  );
}

"use client";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDeal } from "@/app/app/projects/actions";
import { Stat } from "@/components/shared/stat";
import { SourceTag } from "@/components/shared/source-tag";
import { Term } from "@/components/shared/term";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, UnitInput } from "@/components/ui/input";
import type { ResolvedConfig } from "@/lib/config/resolve";
import { taxRatesFromConfig } from "@/lib/config/resolve";
import { analyzeDeal, analyzeScenario, deriveScenarios, type DealInputs, type ScenarioInputs, type ScenarioKind } from "@/lib/finance/deal-engine";
import { bpsToInput, centsToInput, formatBps, formatEur, formatPct, parseEurToCents, parsePctToBps } from "@/lib/format";
import { computeRiskFlags, type RiskInput } from "@/lib/risk/risk-rules";
import { cn } from "@/lib/utils";
import { TAX_PROFILES } from "@/lib/validation/project";
import { AssumptionsList } from "./assumptions-list";
import { DealResultsTable } from "./deal-results-table";
import type { FieldErrors } from "./property-fields";
import { RiskList } from "./risk-list";

const KINDS: ScenarioKind[] = ["worst", "expected", "best"];

export interface DealWorkspaceProps {
  projectId: string;
  showActuals: boolean;
  property: { ownershipForm: DealInputs["ownershipForm"]; livingAreaM2: number; buildYear: number; plotType: "owned" | "leased" | "unknown" };
  housingCompany: RiskInput["housingCompany"];
  maintenance: RiskInput["maintenance"];
  manualRisks: { id: string; title: string; detail: string | null; severity: "high" | "medium" | "info" }[];
  org: { vatDeductible: boolean; vatDisplay: "excl" | "incl" };
  config: ResolvedConfig;
  deal: {
    askingPrice: number;
    offerPrice: number | null;
    debtShare: number;
    maintenanceFeeMonthly: number;
    financingFeeMonthly: number;
    utilitiesMonthly: number;
    otherAcquisitionCosts: number;
    otherSellingCosts: number;
    agentFeeBps: number;
    loanToValueBps: number;
    loanArrangementFee: number;
    taxProfile: DealInputs["taxProfile"];
    actualPurchasePrice: number | null;
    actualRenovationCost: number | null;
    actualHoldingMonths: number | null;
    actualSalePrice: number | null;
    notes: string | null;
    scenarios: ScenarioInputs[];
  };
}

type ScenarioState = { salePriceDebtFree: string; renovationBudget: string; contingency: string; holdingMonths: string; interestRate: string };

export function DealWorkspace(props: DealWorkspaceProps) {
  const t = useTranslations("deal");
  const ts = useTranslations("scenario");
  const ttp = useTranslations("taxProfile");
  const tr = useTranslations("risks");
  const ta = useTranslations("assumptions");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const { config, org } = props;
  const rates = useMemo(() => taxRatesFromConfig(config), [config]);
  const vatFactor = 1 + rates.vatBps / 10_000;
  const showInclVat = org.vatDisplay === "incl";
  const isShare = props.property.ownershipForm === "housing_company_share";

  // Renovation costs are stored excluding VAT; optionally shown including VAT.
  const renoToInput = (c: number) => centsToInput(showInclVat ? Math.round(c * vatFactor) : c);
  const renoFromInput = (s: string) => {
    const c = parseEurToCents(s);
    return c === null ? null : showInclVat ? Math.round(c / vatFactor) : c;
  };

  const initial = useMemo(() => {
    const d = props.deal;
    const sc = Object.fromEntries(
      KINDS.map((k) => {
        const s = d.scenarios.find((x) => x.kind === k)!;
        return [
          k,
          {
            salePriceDebtFree: centsToInput(s.salePriceDebtFree),
            renovationBudget: renoToInput(s.renovationBudget),
            contingency: bpsToInput(s.contingencyBps),
            holdingMonths: String(s.holdingMonths),
            interestRate: bpsToInput(s.interestRateBps),
          },
        ];
      }),
    ) as Record<ScenarioKind, ScenarioState>;
    return {
      askingPrice: centsToInput(d.askingPrice),
      offerPrice: centsToInput(d.offerPrice),
      debtShare: centsToInput(d.debtShare),
      maintenanceFeeMonthly: centsToInput(d.maintenanceFeeMonthly),
      financingFeeMonthly: centsToInput(d.financingFeeMonthly),
      utilitiesMonthly: centsToInput(d.utilitiesMonthly),
      otherAcquisitionCosts: centsToInput(d.otherAcquisitionCosts),
      otherSellingCosts: centsToInput(d.otherSellingCosts),
      agentFee: bpsToInput(d.agentFeeBps),
      loanToValue: bpsToInput(d.loanToValueBps),
      loanArrangementFee: centsToInput(d.loanArrangementFee),
      taxProfile: d.taxProfile,
      actualPurchasePrice: centsToInput(d.actualPurchasePrice),
      actualRenovationCost: d.actualRenovationCost === null ? "" : renoToInput(d.actualRenovationCost),
      actualHoldingMonths: d.actualHoldingMonths === null ? "" : String(d.actualHoldingMonths),
      actualSalePrice: centsToInput(d.actualSalePrice),
      notes: d.notes ?? "",
      scenarios: sc,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.deal]);

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (k: Exclude<keyof typeof form, "scenarios">) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const setS = (kind: ScenarioKind, k: keyof ScenarioState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, scenarios: { ...form.scenarios, [kind]: { ...form.scenarios[kind], [k]: e.target.value } } });

  const num = (s: string) => {
    const v = s.trim().replace(",", ".");
    return v ? Number(v) : null;
  };

  // Payload in the server's shape (cents / bps). Invalid values become null and are rejected on save.
  const payload = useMemo(
    () => ({
      askingPrice: parseEurToCents(form.askingPrice),
      offerPrice: parseEurToCents(form.offerPrice),
      debtShare: isShare ? (parseEurToCents(form.debtShare) ?? 0) : 0,
      maintenanceFeeMonthly: parseEurToCents(form.maintenanceFeeMonthly) ?? 0,
      financingFeeMonthly: isShare ? (parseEurToCents(form.financingFeeMonthly) ?? 0) : 0,
      utilitiesMonthly: parseEurToCents(form.utilitiesMonthly) ?? 0,
      otherAcquisitionCosts: parseEurToCents(form.otherAcquisitionCosts) ?? 0,
      otherSellingCosts: parseEurToCents(form.otherSellingCosts) ?? 0,
      agentFeeBps: parsePctToBps(form.agentFee),
      loanToValueBps: parsePctToBps(form.loanToValue) ?? 0,
      loanArrangementFee: parseEurToCents(form.loanArrangementFee) ?? 0,
      taxProfile: form.taxProfile,
      actualPurchasePrice: parseEurToCents(form.actualPurchasePrice),
      actualRenovationCost: renoFromInput(form.actualRenovationCost),
      actualHoldingMonths: num(form.actualHoldingMonths),
      actualSalePrice: parseEurToCents(form.actualSalePrice),
      notes: form.notes || null,
      scenarios: KINDS.map((kind) => {
        const s = form.scenarios[kind];
        return {
          kind,
          salePriceDebtFree: parseEurToCents(s.salePriceDebtFree),
          renovationBudget: renoFromInput(s.renovationBudget) ?? 0,
          contingencyBps: parsePctToBps(s.contingency) ?? 0,
          holdingMonths: num(s.holdingMonths),
          interestRateBps: parsePctToBps(s.interestRate) ?? 0,
        };
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, isShare],
  );

  const inputs: DealInputs = {
    ownershipForm: props.property.ownershipForm,
    livingAreaM2: props.property.livingAreaM2,
    askingPrice: payload.askingPrice ?? 0,
    offerPrice: payload.offerPrice,
    debtShare: payload.debtShare,
    maintenanceFeeMonthly: payload.maintenanceFeeMonthly,
    financingFeeMonthly: payload.financingFeeMonthly,
    utilitiesMonthly: payload.utilitiesMonthly,
    otherAcquisitionCosts: payload.otherAcquisitionCosts,
    otherSellingCosts: payload.otherSellingCosts,
    agentFeeBps: payload.agentFeeBps ?? 0,
    loanToValueBps: payload.loanToValueBps,
    loanArrangementFee: payload.loanArrangementFee,
    taxProfile: payload.taxProfile,
    vatDeductible: org.vatDeductible,
  };
  const scenarioInputs: ScenarioInputs[] = payload.scenarios.map((s) => ({
    ...s,
    salePriceDebtFree: s.salePriceDebtFree ?? 0,
    holdingMonths: s.holdingMonths ?? 0,
  }));
  const results = analyzeDeal(inputs, scenarioInputs, rates);
  const expected = results.find((r) => r.kind === "expected")!;
  const expectedIn = scenarioInputs.find((s) => s.kind === "expected")!;
  const actual =
    payload.actualSalePrice && payload.actualHoldingMonths
      ? analyzeScenario(
          { ...inputs, offerPrice: payload.actualPurchasePrice ?? inputs.offerPrice },
          { kind: "expected", salePriceDebtFree: payload.actualSalePrice, renovationBudget: payload.actualRenovationCost ?? expectedIn.renovationBudget, contingencyBps: 0, holdingMonths: payload.actualHoldingMonths, interestRateBps: expectedIn.interestRateBps },
          rates,
        )
      : null;
  const risks = computeRiskFlags({
    today: new Date(),
    property: props.property,
    housingCompany: props.housingCompany,
    maintenance: props.maintenance,
    deal: { debtShare: inputs.debtShare, purchasePrice: inputs.offerPrice ?? inputs.askingPrice, taxProfile: inputs.taxProfile },
    results,
    config,
  });
  const assumptions = [...new Set(results.flatMap((r) => r.assumptions))];

  function derive() {
    const e = expectedIn;
    const derived = deriveScenarios({ ...e });
    const next = { ...form.scenarios };
    for (const s of derived) {
      if (s.kind === "expected") continue;
      next[s.kind] = {
        salePriceDebtFree: centsToInput(s.salePriceDebtFree),
        renovationBudget: renoToInput(s.renovationBudget),
        contingency: bpsToInput(s.contingencyBps),
        holdingMonths: String(s.holdingMonths),
        interestRate: bpsToInput(s.interestRateBps),
      };
    }
    setForm({ ...form, scenarios: next });
  }

  function save() {
    start(async () => {
      const res = await updateDeal(props.projectId, payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      toast.success(t("saved"));
      router.refresh();
    });
  }

  const renoUnit = showInclVat ? "€ incl. VAT" : "€";
  const err = (k: string) => errors[k];
  const scErr = (kind: ScenarioKind, k: string) => errors[`scenarios.${KINDS.indexOf(kind)}.${k}`];

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Summary first on mobile */}
      <div className="grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-4">
        <Stat label={`${ts("expected")} · ${t("line.profitAfterTax")}`} value={formatEur(expected.profitAfterTax)} tone={expected.profitAfterTax < 0 ? "negative" : "positive"} />
        <Stat label={t("line.roi")} value={formatPct(expected.roi)} hint={`${t("line.annualizedRoi")}: ${formatPct(expected.annualizedRoi)}`} />
        <Stat label={t("line.breakEven")} value={formatEur(expected.breakEvenSalePrice)} hint={expected.perM2.breakEven ? `${formatEur(expected.perM2.breakEven)} / m²` : undefined} />
        <Stat label={t("line.equity")} value={formatEur(expected.equityRequired)} hint={`${t("line.loan")}: ${formatEur(expected.loanAmount)}`} />
      </div>

      <div className="flex flex-col gap-5 lg:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle>{t("inputs")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label={<>{t("askingPrice")}</>} hint={t("askingPriceHint")} error={err("askingPrice")} htmlFor="askingPrice">
              <UnitInput unit="€" id="askingPrice" value={form.askingPrice} onChange={set("askingPrice")} />
            </Field>
            <Field label={t("offerPrice")} hint={t("offerPriceHint")} error={err("offerPrice")} htmlFor="offerPrice">
              <UnitInput unit="€" id="offerPrice" value={form.offerPrice} onChange={set("offerPrice")} />
            </Field>
            {isShare ? (
              <Field label={<Term k="velkaosuus">{t("debtShare")}</Term>} error={err("debtShare")} htmlFor="debtShare">
                <UnitInput unit="€" id="debtShare" value={form.debtShare} onChange={set("debtShare")} />
              </Field>
            ) : null}
            <Field label={<Term k="hoitovastike">{t("maintenanceFee")}</Term>} error={err("maintenanceFeeMonthly")} htmlFor="maintenanceFeeMonthly">
              <UnitInput unit="€/mo" id="maintenanceFeeMonthly" value={form.maintenanceFeeMonthly} onChange={set("maintenanceFeeMonthly")} />
            </Field>
            {isShare ? (
              <Field label={<Term k="rahoitusvastike">{t("financingFee")}</Term>} error={err("financingFeeMonthly")} htmlFor="financingFeeMonthly">
                <UnitInput unit="€/mo" id="financingFeeMonthly" value={form.financingFeeMonthly} onChange={set("financingFeeMonthly")} />
              </Field>
            ) : null}
            <Field label={t("utilities")} hint={t("utilitiesHint")} error={err("utilitiesMonthly")} htmlFor="utilitiesMonthly">
              <UnitInput unit="€/mo" id="utilitiesMonthly" value={form.utilitiesMonthly} onChange={set("utilitiesMonthly")} />
            </Field>
            <Field label={t("otherAcquisitionCosts")} hint={t("otherAcquisitionHint")} error={err("otherAcquisitionCosts")} htmlFor="otherAcquisitionCosts">
              <UnitInput unit="€" id="otherAcquisitionCosts" value={form.otherAcquisitionCosts} onChange={set("otherAcquisitionCosts")} />
            </Field>
            <Field label={t("otherSellingCosts")} hint={t("otherSellingHint")} error={err("otherSellingCosts")} htmlFor="otherSellingCosts">
              <UnitInput unit="€" id="otherSellingCosts" value={form.otherSellingCosts} onChange={set("otherSellingCosts")} />
            </Field>
            <Field label={t("agentFee")} hint={t("agentFeeHint")} error={err("agentFeeBps")} htmlFor="agentFee">
              <UnitInput unit="%" id="agentFee" value={form.agentFee} onChange={set("agentFee")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("financing")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label={t("loanToValue")} hint={t("loanToValueHint")} error={err("loanToValueBps")} htmlFor="loanToValue">
              <UnitInput unit="%" id="loanToValue" value={form.loanToValue} onChange={set("loanToValue")} />
            </Field>
            <Field label={t("loanFee")} error={err("loanArrangementFee")} htmlFor="loanArrangementFee">
              <UnitInput unit="€" id="loanArrangementFee" value={form.loanArrangementFee} onChange={set("loanArrangementFee")} />
            </Field>
            <Field className="col-span-2" label={t("taxProfile")} htmlFor="taxProfile">
              <Select id="taxProfile" value={form.taxProfile} onChange={set("taxProfile")}>
                {TAX_PROFILES.map((p) => (
                  <option key={p} value={p}>
                    {ttp(p)}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("scenarios")}</CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={derive}>
              <Sparkles /> {t("deriveScenarios")}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-x-2 gap-y-3 text-sm">
              <span />
              {KINDS.map((k) => (
                <span key={k} className={cn("text-center text-xs font-medium uppercase tracking-wide", k === "expected" ? "text-foreground" : "text-muted")}>
                  {ts(k)}
                </span>
              ))}
              {(
                [
                  ["salePriceDebtFree", t("salePrice"), "€"],
                  ["renovationBudget", t("renovationBudget"), renoUnit === "€" ? "€" : "€*"],
                  ["contingency", t("contingency"), "%"],
                  ["holdingMonths", t("holdingMonths"), "mo"],
                  ["interestRate", t("interestRate"), "%"],
                ] as const
              ).map(([k, label, unit]) => (
                <div key={k} className="contents">
                  <span className="max-w-28 text-xs text-muted">
                    {label} <span className="whitespace-nowrap">({unit})</span>
                  </span>
                  {KINDS.map((kind) => {
                    const e = scErr(kind, k === "contingency" ? "contingencyBps" : k === "interestRate" ? "interestRateBps" : k);
                    return (
                      <Input
                        key={kind}
                        inputMode="decimal"
                        aria-label={`${ts(kind)} ${label}`}
                        aria-invalid={Boolean(e)}
                        className="px-2 text-right tabular"
                        value={form.scenarios[kind][k]}
                        onChange={setS(kind, k)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">{showInclVat ? `* ${t("renovationBudget")}: incl. VAT ${formatBps(rates.vatBps)}; stored excl. VAT.` : t("renovationHintExcl")}</p>
          </CardContent>
        </Card>

        {props.showActuals ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("actual")}</CardTitle>
              <CardDescription>{t("actualHint")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label={t("actualPurchase")} htmlFor="actualPurchasePrice">
                <UnitInput unit="€" id="actualPurchasePrice" value={form.actualPurchasePrice} onChange={set("actualPurchasePrice")} />
              </Field>
              <Field label={t("actualRenovation")} htmlFor="actualRenovationCost">
                <UnitInput unit={renoUnit === "€" ? "€" : "€*"} id="actualRenovationCost" value={form.actualRenovationCost} onChange={set("actualRenovationCost")} />
              </Field>
              <Field label={t("actualMonths")} htmlFor="actualHoldingMonths">
                <UnitInput unit="mo" id="actualHoldingMonths" value={form.actualHoldingMonths} onChange={set("actualHoldingMonths")} />
              </Field>
              <Field label={t("actualSale")} htmlFor="actualSalePrice">
                <UnitInput unit="€" id="actualSalePrice" value={form.actualSalePrice} onChange={set("actualSalePrice")} />
              </Field>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 lg:col-span-7">
        <Card>
          <CardHeader>
            <CardTitle>{t("results")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DealResultsTable results={results} actual={actual} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tr("title")}</CardTitle>
            <CardDescription>{tr("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RiskList flags={risks} manual={props.manualRisks} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{ta("title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AssumptionsList codes={assumptions} />
            <div className="rounded-lg bg-surface-muted p-3 text-sm">
              <p className="font-medium">{t("ratesFrom")}</p>
              <ul className="mt-2 space-y-1.5 text-muted">
                <li>
                  <Term k="varainsiirtovero" />: {formatBps(isShare ? rates.transferTaxHousingShareBps : rates.transferTaxRealEstateBps)}{" "}
                  <SourceTag source={config[isShare ? "tax.transfer.housing_share" : "tax.transfer.real_estate"].source} url={config[isShare ? "tax.transfer.housing_share" : "tax.transfer.real_estate"].sourceUrl} date={config[isShare ? "tax.transfer.housing_share" : "tax.transfer.real_estate"].validFrom} />
                </li>
                <li>
                  {inputs.taxProfile === "company"
                    ? t("taxNoteCompany", { rate: formatBps(rates.corporateTaxBps) })
                    : t("taxNoteIndividual", { lower: formatBps(rates.capitalIncomeLowerBps), upper: formatBps(rates.capitalIncomeUpperBps), threshold: formatEur(rates.capitalIncomeThreshold) })}{" "}
                  <SourceTag source={config[inputs.taxProfile === "company" ? "tax.corporate" : "tax.capital_income.lower"].source} url={config[inputs.taxProfile === "company" ? "tax.corporate" : "tax.capital_income.lower"].sourceUrl} date={config[inputs.taxProfile === "company" ? "tax.corporate" : "tax.capital_income.lower"].validFrom} />
                </li>
                <li>
                  {t("vatNote", { rate: formatBps(rates.vatBps), deductible: org.vatDeductible ? "yes" : "no" })}{" "}
                  <SourceTag source={config["tax.vat.general"].source} url={config["tax.vat.general"].sourceUrl} date={config["tax.vat.general"].validFrom} />
                </li>
              </ul>
              <Link href="/app/settings/config" className="mt-2 inline-block text-xs text-primary hover:underline">
                {t("editRates")} →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky save bar */}
      <div className={cn("sticky bottom-3 z-20 lg:col-span-12", !dirty && "pointer-events-none opacity-0")} aria-hidden={!dirty}>
        <Alert tone="info" className="items-center justify-between bg-surface shadow-lg">
          <div className="flex w-full items-center justify-between gap-3">
            <span>{t("unsaved")}</span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(initial)}>
                {tc("discard")}
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={pending || !dirty}>
                {pending ? tc("saving") : tc("save")}
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    </div>
  );
}

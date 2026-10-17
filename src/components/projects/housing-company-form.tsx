"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveHousingCompany } from "@/app/app/projects/actions";
import { Term } from "@/components/shared/term";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { FieldErrors } from "@/lib/forms/property-form";

export interface HousingCompanyValues {
  name: string | null;
  businessId: string | null;
  managerName: string | null;
  managerEmail: string | null;
  managerPhone: string | null;
  unitsTotal: number | null;
  lastPipeRenovationYear: number | null;
  lastFacadeRenovationYear: number | null;
  lastRoofRenovationYear: number | null;
  managerCertificateDate: string | null;
  maintenancePlanDate: string | null;
  renovationNoticeNotes: string | null;
  notes: string | null;
}

const NUMERIC = ["unitsTotal", "lastPipeRenovationYear", "lastFacadeRenovationYear", "lastRoofRenovationYear"] as const;

export function HousingCompanyForm({ projectId, initial }: { projectId: string; initial: HousingCompanyValues }) {
  const t = useTranslations("housingCompany");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const toState = (v: HousingCompanyValues) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === null ? "" : String(x)])) as Record<keyof HousingCompanyValues, string>;
  const [form, setForm] = useState(toState(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (k: keyof HousingCompanyValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()]));
    for (const k of NUMERIC) payload[k] = form[k].trim() ? Number(form[k]) : null;
    start(async () => {
      const res = await saveHousingCompany(projectId, payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      setErrors({});
      toast.success(t("saved"));
      router.refresh();
    });
  }

  const text = (k: keyof HousingCompanyValues, label: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement> = {}, className = "") => (
    <Field className={className} label={label} error={errors[k]} htmlFor={`hc-${k}`}>
      <Input id={`hc-${k}`} value={form[k]} onChange={set(k)} {...props} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {text("name", t("name"), { placeholder: t("namePlaceholder") }, "sm:col-span-2")}
      {text("businessId", t("businessId"), { placeholder: "1234567-8" })}
      {text("unitsTotal", t("unitsTotal"), { inputMode: "numeric" })}
      {text("managerName", <Term k="isannoitsija">{t("managerName")}</Term>)}
      {text("managerEmail", t("managerEmail"), { type: "email" })}
      {text("managerPhone", t("managerPhone"), { type: "tel" })}
      <span className="hidden sm:block" />
      {text("lastPipeRenovationYear", <Term k="putkiremontti">{t("lastPipe")}</Term>, { inputMode: "numeric", maxLength: 4 })}
      {text("lastFacadeRenovationYear", t("lastFacade"), { inputMode: "numeric", maxLength: 4 })}
      {text("lastRoofRenovationYear", t("lastRoof"), { inputMode: "numeric", maxLength: 4 })}
      <span className="hidden sm:block" />
      {text("managerCertificateDate", <Term k="isannoitsijantodistus">{t("certificateDate")}</Term>, { type: "date" })}
      {text("maintenancePlanDate", <Term k="pts">{t("ptsDate")}</Term>, { type: "date" })}
      <Field className="sm:col-span-2" label={<Term k="muutostyoilmoitus">{t("renovationNotice")}</Term>} hint={t("renovationNoticeHint")} error={errors.renovationNoticeNotes} htmlFor="hc-notice">
        <Textarea id="hc-notice" value={form.renovationNoticeNotes} onChange={set("renovationNoticeNotes")} />
      </Field>
      <Field className="sm:col-span-2" label={t("notes")} error={errors.notes} htmlFor="hc-notes">
        <Textarea id="hc-notes" value={form.notes} onChange={set("notes")} />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </div>
    </form>
  );
}

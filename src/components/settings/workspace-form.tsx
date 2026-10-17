"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateWorkspace } from "@/app/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

export function WorkspaceForm({ initial, editable }: { initial: { name: string; defaultTaxProfile: "company" | "individual"; vatDisplay: "excl" | "incl"; vatDeductible: boolean }; editable: boolean }) {
  const t = useTranslations("settings");
  const ttp = useTranslations("taxProfile");
  const tc = useTranslations("common");
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateWorkspace(form);
          if (!res.ok) return void toast.error(res.error);
          toast.success(t("saved"));
          router.refresh();
        });
      }}
    >
      <fieldset disabled={!editable} className="flex flex-col gap-4">
        <Field label={t("workspaceName")} htmlFor="ws-name">
          <Input id="ws-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label={t("defaultTaxProfile")} htmlFor="ws-tax">
          <Select id="ws-tax" value={form.defaultTaxProfile} onChange={(e) => setForm({ ...form, defaultTaxProfile: e.target.value as "company" })}>
            <option value="company">{ttp("company")}</option>
            <option value="individual">{ttp("individual")}</option>
          </Select>
        </Field>
        <Field label={t("vatDisplay")} htmlFor="ws-vat">
          <Select id="ws-vat" value={form.vatDisplay} onChange={(e) => setForm({ ...form, vatDisplay: e.target.value as "excl" })}>
            <option value="excl">{t("vatExcl")}</option>
            <option value="incl">{t("vatIncl")}</option>
          </Select>
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={form.vatDeductible} onChange={(e) => setForm({ ...form, vatDeductible: e.target.checked })} />
          <span>
            {t("vatDeductible")}
            <span className="mt-0.5 block text-xs text-muted">{t("vatDeductibleHint")}</span>
          </span>
        </label>
        {editable ? (
          <Button type="submit" className="self-start" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        ) : null}
      </fieldset>
    </form>
  );
}

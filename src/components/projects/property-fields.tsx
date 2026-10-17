"use client";
import { useTranslations } from "next-intl";
import { Term } from "@/components/shared/term";
import { Field, Input, Select, UnitInput } from "@/components/ui/input";
import type { FieldErrors, PropertyFormState } from "@/lib/forms/property-form";
import { BUILDING_TYPES, CONDITIONS, OWNERSHIP_FORMS, PLOT_TYPES } from "@/lib/validation/project";

export { emptyProperty, fromProperty, toPropertyPayload, type FieldErrors, type PropertyFormState } from "@/lib/forms/property-form";

export function PropertyFields({
  value,
  onChange,
  errors = {},
  prefix = "",
}: {
  value: PropertyFormState;
  onChange: (v: PropertyFormState) => void;
  errors?: FieldErrors;
  prefix?: string;
}) {
  const t = useTranslations("property");
  const tc = useTranslations("common");
  const tb = useTranslations("buildingType");
  const to = useTranslations("ownershipForm");
  const tcond = useTranslations("condition");
  const tp = useTranslations("plotType");
  const set = <K extends keyof PropertyFormState>(k: K, v: PropertyFormState[K]) => onChange({ ...value, [k]: v });
  const err = (k: string) => errors[`${prefix}${k}`];
  const id = (k: string) => `prop-${k}`;

  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Field className="sm:col-span-4" label={t("streetAddress")} error={err("streetAddress")} htmlFor={id("streetAddress")}>
        <Input id={id("streetAddress")} required autoComplete="off" value={value.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} />
      </Field>
      <Field className="sm:col-span-2" label={t("unit")} error={err("unit")} htmlFor={id("unit")}>
        <Input id={id("unit")} placeholder={t("unitPlaceholder")} value={value.unit} onChange={(e) => set("unit", e.target.value)} />
      </Field>
      <Field className="sm:col-span-2" label={t("postalCode")} error={err("postalCode")} htmlFor={id("postalCode")}>
        <Input id={id("postalCode")} inputMode="numeric" maxLength={5} required value={value.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
      </Field>
      <Field className="sm:col-span-2" label={t("municipality")} error={err("municipality")} htmlFor={id("municipality")}>
        <Input id={id("municipality")} required value={value.municipality} onChange={(e) => set("municipality", e.target.value)} />
      </Field>
      <Field className="sm:col-span-2" label={`${t("district")} (${tc("optional")})`} error={err("district")} htmlFor={id("district")}>
        <Input id={id("district")} placeholder={t("districtPlaceholder")} value={value.district} onChange={(e) => set("district", e.target.value)} />
      </Field>

      <Field className="sm:col-span-3" label={t("buildingType")} htmlFor={id("buildingType")}>
        <Select id={id("buildingType")} value={value.buildingType} onChange={(e) => set("buildingType", e.target.value as PropertyFormState["buildingType"])}>
          {BUILDING_TYPES.map((v) => (
            <option key={v} value={v}>
              {tb(v)}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        className="sm:col-span-3"
        label={
          <>
            {t("ownershipForm")} · <Term k="asuntoOsake" />
          </>
        }
        htmlFor={id("ownershipForm")}
      >
        <Select id={id("ownershipForm")} value={value.ownershipForm} onChange={(e) => set("ownershipForm", e.target.value as PropertyFormState["ownershipForm"])}>
          {OWNERSHIP_FORMS.map((v) => (
            <option key={v} value={v}>
              {to(v)}
            </option>
          ))}
        </Select>
      </Field>

      <Field className="col-span-1 sm:col-span-2" label={t("livingArea")} error={err("livingAreaM2")} htmlFor={id("livingAreaM2")}>
        <UnitInput unit="m²" id={id("livingAreaM2")} required value={value.livingAreaM2} onChange={(e) => set("livingAreaM2", e.target.value)} />
      </Field>
      <Field className="sm:col-span-2" label={t("rooms")} error={err("rooms")} htmlFor={id("rooms")}>
        <Input id={id("rooms")} inputMode="numeric" required value={value.rooms} onChange={(e) => set("rooms", e.target.value)} />
      </Field>
      <Field className="sm:col-span-2" label={t("layout")} error={err("layout")} htmlFor={id("layout")}>
        <Input id={id("layout")} placeholder={t("layoutPlaceholder")} value={value.layout} onChange={(e) => set("layout", e.target.value)} />
      </Field>

      <Field className="sm:col-span-2" label={t("buildYear")} error={err("buildYear")} htmlFor={id("buildYear")}>
        <Input id={id("buildYear")} inputMode="numeric" maxLength={4} required value={value.buildYear} onChange={(e) => set("buildYear", e.target.value)} />
      </Field>
      <Field className="sm:col-span-2" label={t("floor")} error={err("floor")} htmlFor={id("floor")}>
        <Input id={id("floor")} inputMode="numeric" value={value.floor} onChange={(e) => set("floor", e.target.value)} />
      </Field>
      <Field className="sm:col-span-2" label={t("floorsTotal")} error={err("floorsTotal")} htmlFor={id("floorsTotal")}>
        <Input id={id("floorsTotal")} inputMode="numeric" value={value.floorsTotal} onChange={(e) => set("floorsTotal", e.target.value)} />
      </Field>

      <Field className="sm:col-span-2" label={t("condition")} htmlFor={id("condition")}>
        <Select id={id("condition")} value={value.condition} onChange={(e) => set("condition", e.target.value as PropertyFormState["condition"])}>
          {CONDITIONS.map((v) => (
            <option key={v} value={v}>
              {tcond(v)}
            </option>
          ))}
        </Select>
      </Field>
      <Field className="sm:col-span-2" label={t("plotType")} htmlFor={id("plotType")}>
        <Select id={id("plotType")} value={value.plotType} onChange={(e) => set("plotType", e.target.value as PropertyFormState["plotType"])}>
          {PLOT_TYPES.map((v) => (
            <option key={v} value={v}>
              {tp(v)}
            </option>
          ))}
        </Select>
      </Field>
      <Field className="sm:col-span-2" label={t("hasElevator")} htmlFor={id("hasElevator")}>
        <Select id={id("hasElevator")} value={value.hasElevator} onChange={(e) => set("hasElevator", e.target.value as PropertyFormState["hasElevator"])}>
          <option value="">{tc("unknown")}</option>
          <option value="yes">{tc("yes")}</option>
          <option value="no">{tc("no")}</option>
        </Select>
      </Field>

      <div className="flex flex-wrap items-center gap-6 sm:col-span-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={value.hasSauna} onChange={(e) => set("hasSauna", e.target.checked)} />
          {t("hasSauna")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={value.hasBalcony} onChange={(e) => set("hasBalcony", e.target.checked)} />
          {t("hasBalcony")}
        </label>
      </div>
      <Field className="sm:col-span-2" label={`${t("energyClass")} (${tc("optional")})`} htmlFor={id("energyClass")}>
        <Input id={id("energyClass")} maxLength={4} value={value.energyClass} onChange={(e) => set("energyClass", e.target.value)} />
      </Field>
    </div>
  );
}

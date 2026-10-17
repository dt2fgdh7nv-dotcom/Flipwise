"use client";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addMaintenanceItem, deleteMaintenanceItem } from "@/app/app/projects/actions";
import { SourceTag } from "@/components/shared/source-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, UnitInput } from "@/components/ui/input";
import { formatEur, parseEurToCents } from "@/lib/format";
import type { FieldErrors } from "@/lib/forms/property-form";
import { MAINTENANCE_KINDS, MAINTENANCE_STATUSES } from "@/lib/validation/project";

export interface MaintenanceItemView {
  id: string;
  kind: (typeof MAINTENANCE_KINDS)[number];
  plannedYear: number;
  status: (typeof MAINTENANCE_STATUSES)[number];
  estCostPerM2: number | null;
  source: string;
  notes: string | null;
  updatedAt: Date;
}

export function MaintenanceItems({ projectId, items, areaM2, editable }: { projectId: string; items: MaintenanceItemView[]; areaM2: number; editable: boolean }) {
  const t = useTranslations("housingCompany");
  const tk = useTranslations("maintenanceKind");
  const ts = useTranslations("maintenanceStatus");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const empty = { kind: "pipe_renovation", plannedYear: String(new Date().getFullYear() + 2), status: "planned", estCostPerM2: "", source: "", notes: "" };
  const [form, setForm] = useState(empty);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? <p className="text-sm text-muted">{t("noItems")}</p> : null}
      <ul className="divide-y divide-border">
        {items.map((m) => {
          const soon = m.status !== "done" && m.plannedYear >= year && m.plannedYear <= year + 5;
          return (
            <li key={m.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {tk(m.kind)} · {m.plannedYear}
                  <Badge tone={m.status === "done" ? "success" : soon ? "warning" : "neutral"}>{ts(m.status)}</Badge>
                </p>
                {m.estCostPerM2 ? (
                  <p className="mt-0.5 text-sm text-muted tabular">
                    {formatEur(m.estCostPerM2)}/m² · {t("estShare")}: {formatEur(Math.round(m.estCostPerM2 * areaM2))}
                  </p>
                ) : null}
                {m.notes ? <p className="mt-0.5 text-sm text-muted">{m.notes}</p> : null}
                <SourceTag className="mt-1" source={m.source} date={m.updatedAt} />
              </div>
              {editable ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={tc("remove")}
                  onClick={() =>
                    start(async () => {
                      const res = await deleteMaintenanceItem(projectId, m.id);
                      if (!res.ok) toast.error(res.error);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editable ? (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title={t("addItem")}
          trigger={
            <Button variant="secondary" size="sm" className="self-start">
              <Plus /> {t("addItem")}
            </Button>
          }
        >
          <form
            className="grid grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await addMaintenanceItem(projectId, {
                  kind: form.kind,
                  plannedYear: Number(form.plannedYear),
                  status: form.status,
                  estCostPerM2: parseEurToCents(form.estCostPerM2),
                  source: form.source,
                  notes: form.notes || null,
                });
                if (!res.ok) {
                  setErrors(res.fieldErrors ?? {});
                  return void toast.error(res.error);
                }
                toast.success(t("itemAdded"));
                setForm(empty);
                setErrors({});
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Field className="col-span-2" label={t("kind")} htmlFor="m-kind">
              <Select id="m-kind" value={form.kind} onChange={set("kind")}>
                {MAINTENANCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {tk(k)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("year")} error={errors.plannedYear} htmlFor="m-year">
              <Input id="m-year" inputMode="numeric" maxLength={4} value={form.plannedYear} onChange={set("plannedYear")} />
            </Field>
            <Field label={t("status")} htmlFor="m-status">
              <Select id="m-status" value={form.status} onChange={set("status")}>
                {MAINTENANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ts(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="col-span-2" label={t("costPerM2")} error={errors.estCostPerM2} htmlFor="m-cost">
              <UnitInput unit="€/m²" id="m-cost" value={form.estCostPerM2} onChange={set("estCostPerM2")} />
            </Field>
            <Field className="col-span-2" label={t("source")} error={errors.source} htmlFor="m-source">
              <Input id="m-source" required placeholder={t("sourcePlaceholder")} value={form.source} onChange={set("source")} />
            </Field>
            <Field className="col-span-2" label={t("notes")} htmlFor="m-notes">
              <Textarea id="m-notes" value={form.notes} onChange={set("notes")} />
            </Field>
            <Button type="submit" className="col-span-2" disabled={pending}>
              {tc("add")}
            </Button>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}

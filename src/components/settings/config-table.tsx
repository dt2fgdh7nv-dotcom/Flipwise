"use client";
import { History, Pencil, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deletePlatformConfigVersion, removeConfigOverrides, setConfigOverride, setPlatformConfig } from "@/app/app/settings/actions";
import { SourceTag } from "@/components/shared/source-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea, UnitInput } from "@/components/ui/input";
import type { ConfigKey, ConfigUnit } from "@/lib/config/definitions";
import { configLabelKey, configToInput, configUnitLabel, formatConfigValue } from "@/lib/config/units";
import { formatDate } from "@/lib/format";
import type { FieldErrors } from "@/lib/forms/property-form";

export interface ConfigRowView {
  key: ConfigKey;
  group: "tax" | "deal" | "risk";
  unit: ConfigUnit;
  value: number;
  validFrom: string;
  source: string;
  sourceUrl: string | null;
  notes: string | null;
  scope: "platform" | "organization";
  hasOverride: boolean;
  history?: { id: string; value: number; validFrom: string; source: string; updatedAt: Date }[];
}

export function ConfigTable({ rows, mode, canEdit, today }: { rows: ConfigRowView[]; mode: "org" | "platform"; canEdit: boolean; today: string }) {
  const t = useTranslations("settings");
  const tk = useTranslations("configKeys");
  const groups = ["tax", "deal", "risk"] as const;
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => (
        <section key={g}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{t(`groups.${g}`)}</h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {rows
              .filter((r) => r.group === g)
              .map((r) => (
                <li key={r.key} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tk(configLabelKey(r.key))}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold tabular">{formatConfigValue(r.value, r.unit)}</span>
                      {mode === "org" ? <Badge tone={r.scope === "organization" ? "info" : "neutral"}>{r.scope === "organization" ? t("scopeOrg") : t("scopePlatform")}</Badge> : null}
                    </p>
                    <SourceTag className="mt-1" source={r.source} url={r.sourceUrl} date={r.validFrom} />
                    {r.notes ? <p className="mt-1 text-xs text-muted">{r.notes}</p> : null}
                    {r.history && r.history.length > 1 ? <HistoryList rows={r.history} unit={r.unit} canEdit={canEdit} /> : null}
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 gap-2">
                      {mode === "org" && r.hasOverride ? <RemoveOverrideButton k={r.key} /> : null}
                      <EditValueDialog row={r} mode={mode} today={today} />
                    </div>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function HistoryList({ rows, unit, canEdit }: { rows: NonNullable<ConfigRowView["history"]>; unit: ConfigUnit; canEdit: boolean }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <details className="mt-2 text-xs">
      <summary className="flex cursor-pointer items-center gap-1 text-muted">
        <History className="size-3.5" /> {t("history")} ({rows.length})
      </summary>
      <ul className="mt-1 space-y-1 pl-5">
        {rows.map((h) => (
          <li key={h.id} className="flex items-center gap-2">
            <span className="tabular">{formatConfigValue(h.value, unit)}</span>
            <span className="text-muted">
              from {formatDate(h.validFrom)} · {h.source}
            </span>
            {canEdit ? (
              <button
                aria-label="Delete version"
                disabled={pending}
                className="text-muted hover:text-danger"
                onClick={() =>
                  start(async () => {
                    const res = await deletePlatformConfigVersion(h.id);
                    if (!res.ok) toast.error(res.error);
                    router.refresh();
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function RemoveOverrideButton({ k }: { k: ConfigKey }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await removeConfigOverrides(k);
          if (!res.ok) return void toast.error(res.error);
          router.refresh();
        })
      }
    >
      <Undo2 /> {t("removeOverride")}
    </Button>
  );
}

function EditValueDialog({ row, mode, today }: { row: ConfigRowView; mode: "org" | "platform"; today: string }) {
  const t = useTranslations("settings");
  const ta = useTranslations("admin");
  const tk = useTranslations("configKeys");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const initial = { value: configToInput(row.value, row.unit), validFrom: today, source: mode === "platform" ? row.source : "", sourceUrl: mode === "platform" ? (row.sourceUrl ?? "") : "", notes: "" };
  const [f, setF] = useState(initial);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setF(initial);
      }}
      title={mode === "org" ? t("overrideTitle") : ta("newVersion")}
      description={tk(configLabelKey(row.key))}
      trigger={
        <Button variant="secondary" size="sm">
          <Pencil /> {mode === "org" ? t("override") : ta("newVersion")}
        </Button>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const payload = { key: row.key, ...f };
            const res = mode === "org" ? await setConfigOverride(payload) : await setPlatformConfig(payload);
            if (!res.ok) {
              setErrors(res.fieldErrors ?? {});
              return void toast.error(res.error);
            }
            toast.success(t("configSaved"));
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <Field label={t("value")} error={errors.value} htmlFor="cfg-value">
          <UnitInput unit={configUnitLabel(row.unit)} id="cfg-value" required value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        </Field>
        <Field label={t("validFrom")} error={errors.validFrom} htmlFor="cfg-from">
          <Input id="cfg-from" type="date" required value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} />
        </Field>
        <Field className="col-span-2" label={t("source")} hint={t("sourceHint")} error={errors.source} htmlFor="cfg-source">
          <Input id="cfg-source" required value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
        </Field>
        <Field className="col-span-2" label="URL" error={errors.sourceUrl} htmlFor="cfg-url">
          <Input id="cfg-url" type="url" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} />
        </Field>
        <Field className="col-span-2" label={t("notes")} htmlFor="cfg-notes">
          <Textarea id="cfg-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <Button type="submit" className="col-span-2" disabled={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </form>
    </Dialog>
  );
}

"use client";
import { Download, Pencil, Plus, Search, Trash2, Undo2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SourceTag } from "@/components/shared/source-tag";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, UnitInput } from "@/components/ui/input";
import { toCostCsv } from "@/lib/costs/csv";
import type { Certification, CostCategory, CostUnit } from "@/lib/costs/seed-catalogue";
import { CERTIFICATIONS, COST_CATEGORIES, COST_UNITS } from "@/lib/costs/validation";
import { formatEur, parseEurToCents } from "@/lib/format";
import type { FieldErrors } from "@/lib/forms/property-form";
import { cn } from "@/lib/utils";
import { createOrgCustomItem, deleteOrgCostItem, importPlatformCostCsv, saveOrgOverride, savePlatformItem } from "@/server/actions/costs";

export interface CostItemView {
  id: string;
  platformItemId: string | null;
  scope: "platform" | "override" | "custom";
  code: string;
  category: CostCategory;
  nameEn: string;
  nameFi: string | null;
  unit: CostUnit;
  budgetLow: number;
  budgetHigh: number;
  midLow: number;
  midHigh: number;
  premiumLow: number;
  premiumHigh: number;
  laborBps: number;
  certification: Certification | null;
  needsRenovationNotice: boolean;
  priceDate: string;
  source: string;
  sourceUrl: string | null;
  notes: string | null;
  active: boolean;
}

const TIERS = [
  ["budget", "budgetLow", "budgetHigh"],
  ["mid", "midLow", "midHigh"],
  ["premium", "premiumLow", "premiumHigh"],
] as const;

export function CostDatabase({
  items,
  mode,
  canEdit,
  vatDisplay = "excl",
  vatBps,
  today,
}: {
  items: CostItemView[];
  mode: "org" | "platform";
  canEdit: boolean;
  vatDisplay?: "excl" | "incl";
  vatBps: number;
  today: string;
}) {
  const t = useTranslations("costs");
  const tcat = useTranslations("costCategory");
  const [category, setCategory] = useState<CostCategory | null>(null);
  const [q, setQ] = useState("");
  const show = (c: number) => (vatDisplay === "incl" ? Math.round(c * (1 + vatBps / 10_000)) : c);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => (!category || i.category === category) && (!s || i.nameEn.toLowerCase().includes(s) || (i.nameFi ?? "").toLowerCase().includes(s) || i.code.includes(s)));
  }, [items, category, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {mode === "platform" ? (
              <>
                <ExportCsvButton items={items} />
                <ImportCsvButton />
              </>
            ) : null}
            <ItemEditor mode={mode} today={today} />
          </div>
        ) : null}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {[null, ...COST_CATEGORIES].map((c) => (
          <button
            key={c ?? "all"}
            onClick={() => setCategory(c)}
            className={cn("shrink-0 rounded-full border px-3 py-1 text-sm", category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted")}
          >
            {c ? tcat(c) : t("all")}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {filtered.map((i) => (
          <CostRow key={i.id} item={i} mode={mode} canEdit={canEdit} show={show} today={today} />
        ))}
      </ul>
    </div>
  );
}

function CostRow({ item: i, mode, canEdit, show, today }: { item: CostItemView; mode: "org" | "platform"; canEdit: boolean; show: (c: number) => number; today: string }) {
  const t = useTranslations("costs");
  const tt = useTranslations("tier");
  const tu = useTranslations("costUnit");
  const tcert = useTranslations("certification");
  const tr = useTranslations("renovation");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <li className={cn("flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between", !i.active && "opacity-50")}>
      <div className="min-w-0 lg:w-80">
        <p className="text-sm font-medium">{i.nameEn}</p>
        {i.nameFi ? <p className="text-xs italic text-muted">{i.nameFi}</p> : null}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {mode === "org" ? <Badge tone={i.scope === "platform" ? "neutral" : "info"}>{t(`scope.${i.scope}`)}</Badge> : null}
          {i.certification ? (
            <Badge tone="warning" title={tcert(`${i.certification}.detail`)}>
              {tcert(`${i.certification}.label`)}
            </Badge>
          ) : null}
          {i.needsRenovationNotice ? <Badge tone="info">{tr("noticeBadge")}</Badge> : null}
          <span className="text-muted">
            {t("labor")} {i.laborBps / 100} %
          </span>
        </p>
        <SourceTag className="mt-1" source={i.source} url={i.sourceUrl} date={i.priceDate} />
        {i.notes ? <p className="mt-1 text-xs text-muted">{i.notes}</p> : null}
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm lg:w-[26rem]">
        {TIERS.map(([tier, lo, hi]) => (
          <div key={tier}>
            <dt className="text-xs text-muted">{tt(tier)}</dt>
            <dd className="tabular">
              {formatEur(show(i[lo]))}–{formatEur(show(i[hi])).replace("€", "")}
              <span className="text-xs text-muted"> /{tu(i.unit)}</span>
            </dd>
          </div>
        ))}
      </dl>
      {canEdit ? (
        <div className="flex shrink-0 gap-2">
          {mode === "platform" ? <ItemEditor mode="platform" item={i} today={today} /> : null}
          {mode === "org" && i.scope !== "custom" ? <ItemEditor mode="org" item={i} pricesOnly today={today} /> : null}
          {mode === "org" && i.scope !== "platform" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteOrgCostItem(i.id);
                  if (!res.ok) toast.error(res.error);
                  router.refresh();
                })
              }
            >
              {i.scope === "override" ? (
                <>
                  <Undo2 /> {t("removeOverride")}
                </>
              ) : (
                <>
                  <Trash2 /> {t("deleteItem")}
                </>
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

const eurStr = (c: number | undefined) => (c === undefined ? "" : String(c / 100));

function ItemEditor({ mode, item, pricesOnly, today }: { mode: "org" | "platform"; item?: CostItemView; pricesOnly?: boolean; today: string }) {
  const t = useTranslations("costs");
  const tt = useTranslations("tier");
  const tcat = useTranslations("costCategory");
  const tu = useTranslations("costUnit");
  const tcert = useTranslations("certification");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const init = () => ({
    code: item?.code ?? "",
    category: item?.category ?? ("kitchen" as CostCategory),
    nameEn: item?.nameEn ?? "",
    nameFi: item?.nameFi ?? "",
    unit: item?.unit ?? ("m2" as CostUnit),
    budgetLow: eurStr(item?.budgetLow),
    budgetHigh: eurStr(item?.budgetHigh),
    midLow: eurStr(item?.midLow),
    midHigh: eurStr(item?.midHigh),
    premiumLow: eurStr(item?.premiumLow),
    premiumHigh: eurStr(item?.premiumHigh),
    laborPct: item ? String(item.laborBps / 100) : "50",
    certification: item?.certification ?? "",
    needsRenovationNotice: item?.needsRenovationNotice ?? false,
    // A workspace override documents its own source.
    priceDate: pricesOnly ? today : (item?.priceDate ?? today),
    source: pricesOnly && item?.scope !== "override" ? "" : (item?.source ?? ""),
    sourceUrl: pricesOnly && item?.scope !== "override" ? "" : (item?.sourceUrl ?? ""),
    notes: item?.notes ?? "",
    active: item?.active ?? true,
  });
  const [f, setF] = useState(init);
  const set = (k: keyof ReturnType<typeof init>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const prices = {
      budgetLow: parseEurToCents(f.budgetLow),
      budgetHigh: parseEurToCents(f.budgetHigh),
      midLow: parseEurToCents(f.midLow),
      midHigh: parseEurToCents(f.midHigh),
      premiumLow: parseEurToCents(f.premiumLow),
      premiumHigh: parseEurToCents(f.premiumHigh),
      laborBps: Math.round(Number(f.laborPct.replace(",", ".")) * 100),
      priceDate: f.priceDate,
      source: f.source,
      sourceUrl: f.sourceUrl,
      notes: f.notes,
    };
    const full = { ...prices, code: f.code, category: f.category, nameEn: f.nameEn, nameFi: f.nameFi, unit: f.unit, certification: f.certification || null, needsRenovationNotice: f.needsRenovationNotice, active: f.active };
    start(async () => {
      const res = pricesOnly
        ? await saveOrgOverride(item!.platformItemId ?? item!.id, prices)
        : mode === "platform"
          ? await savePlatformItem(item?.id ?? null, full)
          : await createOrgCustomItem(full);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(t("saved"));
      setErrors({});
      setOpen(false);
      router.refresh();
    });
  }

  const title = pricesOnly ? t("override") : item ? t("editItem") : t("newItem");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setF(init());
          setErrors({});
        }
      }}
      title={title}
      description={item ? item.nameEn : undefined}
      trigger={
        item ? (
          <Button variant="secondary" size="sm">
            <Pencil /> {title}
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> {t("newItem")}
          </Button>
        )
      }
    >
      <form className="grid grid-cols-2 gap-4" onSubmit={submit}>
        {!pricesOnly ? (
          <>
            <Field label={t("code")} hint={t("codeHint")} error={errors.code} htmlFor="ci-code">
              <Input id="ci-code" required disabled={Boolean(item)} value={f.code} onChange={set("code")} />
            </Field>
            <Field label={t("category")} htmlFor="ci-cat">
              <Select id="ci-cat" value={f.category} onChange={set("category")}>
                {COST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tcat(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("nameEn")} error={errors.nameEn} htmlFor="ci-en">
              <Input id="ci-en" required value={f.nameEn} onChange={set("nameEn")} />
            </Field>
            <Field label={t("nameFi")} htmlFor="ci-fi">
              <Input id="ci-fi" value={f.nameFi} onChange={set("nameFi")} />
            </Field>
            <Field label={t("unit")} htmlFor="ci-unit">
              <Select id="ci-unit" value={f.unit} onChange={set("unit")}>
                {COST_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {tu(u)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("certificationLabel")} htmlFor="ci-cert">
              <Select id="ci-cert" value={f.certification} onChange={set("certification")}>
                <option value="">{t("none")}</option>
                {CERTIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {tcert(`${c}.label`)}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.needsRenovationNotice} onChange={(e) => setF({ ...f, needsRenovationNotice: e.target.checked })} />
              {t("needsNotice")}
            </label>
          </>
        ) : null}
        {TIERS.map(([tier, lo, hi]) => (
          <div key={tier} className="col-span-2 grid grid-cols-2 gap-4">
            <Field label={`${tt(tier)} — ${t("low")}`} error={errors[lo]} htmlFor={`ci-${lo}`}>
              <UnitInput unit="€" id={`ci-${lo}`} required value={f[lo]} onChange={set(lo)} />
            </Field>
            <Field label={`${tt(tier)} — ${t("high")}`} error={errors[hi]} htmlFor={`ci-${hi}`}>
              <UnitInput unit="€" id={`ci-${hi}`} required value={f[hi]} onChange={set(hi)} />
            </Field>
          </div>
        ))}
        <p className="col-span-2 -mt-2 text-xs text-muted">€ / {tu(f.unit)}, excl. VAT</p>
        <Field label={t("laborPct")} error={errors.laborBps} htmlFor="ci-labor">
          <UnitInput unit="%" id="ci-labor" value={f.laborPct} onChange={set("laborPct")} />
        </Field>
        <Field label={t("priceDate")} error={errors.priceDate} htmlFor="ci-date">
          <Input id="ci-date" type="date" required value={f.priceDate} onChange={set("priceDate")} />
        </Field>
        <Field className="col-span-2" label={t("source")} error={errors.source} htmlFor="ci-source">
          <Input id="ci-source" required value={f.source} onChange={set("source")} />
        </Field>
        <Field className="col-span-2" label={t("sourceUrl")} error={errors.sourceUrl} htmlFor="ci-url">
          <Input id="ci-url" type="url" value={f.sourceUrl} onChange={set("sourceUrl")} />
        </Field>
        <Field className="col-span-2" label={t("notes")} htmlFor="ci-notes">
          <Textarea id="ci-notes" value={f.notes} onChange={set("notes")} />
        </Field>
        {mode === "platform" && item ? (
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            {t("active")}
          </label>
        ) : null}
        <Button type="submit" className="col-span-2" disabled={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </form>
    </Dialog>
  );
}

function ExportCsvButton({ items }: { items: CostItemView[] }) {
  const t = useTranslations("costs");
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        const blob = new Blob(["﻿" + toCostCsv(items)], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `flipwise-costs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      }}
    >
      <Download /> {t("exportCsv")}
    </Button>
  );
}

function ImportCsvButton() {
  const t = useTranslations("costs");
  const tcomp = useTranslations("comparables");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ created: number; updated: number; errors: { line: number; message: string }[] } | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setResult(null);
      }}
      title={t("importCsv")}
      description={t("importHint")}
      trigger={
        <Button variant="secondary" size="sm">
          <Upload /> {t("importCsv")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          type="file"
          accept=".csv,text/csv"
          className="py-2"
          disabled={pending}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            start(async () => {
              const res = await importPlatformCostCsv(file.name, text);
              if (!res.ok) return void toast.error(res.error);
              setResult(res.data!);
              router.refresh();
            });
          }}
        />
        {result ? (
          <>
            <Alert tone={result.errors.length ? "warning" : "success"} title={t("importDone", { created: result.created, updated: result.updated })}>
              {result.errors.length ? tcomp("importErrors", { count: result.errors.length }) : null}
            </Alert>
            {result.errors.length ? (
              <ul className="max-h-40 overflow-y-auto text-xs text-danger">
                {result.errors.map((er) => (
                  <li key={er.line}>
                    {tcomp("line", { line: er.line })}: {er.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

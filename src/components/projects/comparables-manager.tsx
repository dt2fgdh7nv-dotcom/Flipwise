"use client";
import { Download, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addComparable, deleteComparable, importComparablesCsv, refreshMarketTrend } from "@/app/app/projects/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, UnitInput } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { COMPARABLES_CSV_TEMPLATE } from "@/lib/csv/comparables";
import { formatDate, formatEur, parseEurToCents } from "@/lib/format";
import type { FieldErrors } from "@/lib/forms/property-form";
import { BUILDING_TYPES, CONDITIONS } from "@/lib/validation/project";

export interface ComparableView {
  id: string;
  streetAddress: string | null;
  postalCode: string;
  buildingType: (typeof BUILDING_TYPES)[number];
  livingAreaM2: number;
  rooms: number | null;
  buildYear: number | null;
  condition: (typeof CONDITIONS)[number] | null;
  priceDebtFree: number;
  saleDate: string;
  source: string;
  sourceRef: string | null;
}

export function ComparablesTable({ projectId, rows, editable }: { projectId: string; rows: ComparableView[]; editable: boolean }) {
  const t = useTranslations("comparables");
  const tb = useTranslations("buildingTypeShort");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!rows.length) return <p className="text-sm text-muted">{t("empty")}</p>;
  return (
    <Table>
      <THead>
        <TR>
          <TH>{t("address")}</TH>
          <TH className="text-right">{t("area")}</TH>
          <TH className="hidden text-right sm:table-cell">{t("year")}</TH>
          <TH className="text-right">{t("price")}</TH>
          <TH className="text-right">{t("pricePerM2")}</TH>
          <TH className="hidden sm:table-cell">{t("date")}</TH>
          <TH>{t("source")}</TH>
          {editable ? <TH /> : null}
        </TR>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r.id}>
            <TD>
              <p>{r.streetAddress ?? "—"}</p>
              <p className="text-xs text-muted">
                {r.postalCode} · {tb(r.buildingType)}
                {r.rooms ? ` · ${r.rooms}h` : ""}
              </p>
            </TD>
            <TD className="text-right tabular">{r.livingAreaM2} m²</TD>
            <TD className="hidden text-right tabular sm:table-cell">{r.buildYear ?? "—"}</TD>
            <TD className="text-right tabular">{formatEur(r.priceDebtFree)}</TD>
            <TD className="text-right font-medium tabular">{formatEur(Math.round(r.priceDebtFree / r.livingAreaM2))}</TD>
            <TD className="hidden whitespace-nowrap sm:table-cell">{formatDate(r.saleDate)}</TD>
            <TD className="max-w-40 text-xs text-muted">
              {r.source}
              {r.sourceRef ? ` · ${r.sourceRef}` : ""}
              <span className="block sm:hidden">{formatDate(r.saleDate)}</span>
            </TD>
            {editable ? (
              <TD>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={tc("remove")}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await deleteComparable(projectId, r.id);
                      if (!res.ok) toast.error(res.error);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </TD>
            ) : null}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export function AddComparableButton({ projectId, defaults }: { projectId: string; defaults: { postalCode: string; municipality: string; buildingType: ComparableView["buildingType"] } }) {
  const t = useTranslations("comparables");
  const tb = useTranslations("buildingTypeShort");
  const tcond = useTranslations("condition");
  const tc = useTranslations("common");
  const tp = useTranslations("property");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const empty = { streetAddress: "", postalCode: defaults.postalCode, municipality: defaults.municipality, buildingType: defaults.buildingType as string, livingAreaM2: "", rooms: "", buildYear: "", condition: "", priceDebtFree: "", saleDate: "", source: "", sourceRef: "" };
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const n = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : null);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t("add")}
      trigger={
        <Button size="sm">
          <Plus /> {t("add")}
        </Button>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addComparable(projectId, {
              streetAddress: f.streetAddress || null,
              postalCode: f.postalCode,
              municipality: f.municipality || null,
              buildingType: f.buildingType,
              livingAreaM2: n(f.livingAreaM2),
              rooms: n(f.rooms),
              buildYear: n(f.buildYear),
              floor: null,
              condition: f.condition || null,
              priceDebtFree: parseEurToCents(f.priceDebtFree),
              saleDate: f.saleDate,
              source: f.source,
              sourceRef: f.sourceRef || null,
            });
            if (!res.ok) {
              setErrors(res.fieldErrors ?? {});
              return void toast.error(res.error);
            }
            toast.success(t("added"));
            setF(empty);
            setErrors({});
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <Field className="col-span-2" label={t("address")} htmlFor="c-addr">
          <Input id="c-addr" value={f.streetAddress} onChange={set("streetAddress")} />
        </Field>
        <Field label={tp("postalCode")} error={errors.postalCode} htmlFor="c-postal">
          <Input id="c-postal" inputMode="numeric" maxLength={5} value={f.postalCode} onChange={set("postalCode")} />
        </Field>
        <Field label={tp("buildingType")} htmlFor="c-type">
          <Select id="c-type" value={f.buildingType} onChange={set("buildingType")}>
            {BUILDING_TYPES.map((b) => (
              <option key={b} value={b}>
                {tb(b)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("area")} error={errors.livingAreaM2} htmlFor="c-area">
          <UnitInput unit="m²" id="c-area" required value={f.livingAreaM2} onChange={set("livingAreaM2")} />
        </Field>
        <Field label={t("rooms")} error={errors.rooms} htmlFor="c-rooms">
          <Input id="c-rooms" inputMode="numeric" value={f.rooms} onChange={set("rooms")} />
        </Field>
        <Field label={t("year")} error={errors.buildYear} htmlFor="c-year">
          <Input id="c-year" inputMode="numeric" maxLength={4} value={f.buildYear} onChange={set("buildYear")} />
        </Field>
        <Field label={t("condition")} htmlFor="c-cond">
          <Select id="c-cond" value={f.condition} onChange={set("condition")}>
            <option value="">{tc("unknown")}</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {tcond(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("price")} error={errors.priceDebtFree} htmlFor="c-price">
          <UnitInput unit="€" id="c-price" required value={f.priceDebtFree} onChange={set("priceDebtFree")} />
        </Field>
        <Field label={t("date")} error={errors.saleDate} htmlFor="c-date">
          <Input id="c-date" type="date" required value={f.saleDate} onChange={set("saleDate")} />
        </Field>
        <Field className="col-span-2" label={t("source")} error={errors.source} htmlFor="c-source">
          <Input id="c-source" required placeholder={t("sourcePlaceholder")} value={f.source} onChange={set("source")} />
        </Field>
        <Button type="submit" className="col-span-2" disabled={pending}>
          {tc("add")}
        </Button>
      </form>
    </Dialog>
  );
}

export function ImportCsvButton({ projectId }: { projectId: string }) {
  const t = useTranslations("comparables");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ imported: number; errors: { line: number; message: string }[] } | null>(null);
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(COMPARABLES_CSV_TEMPLATE)}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setResult(null);
      }}
      title={t("importTitle")}
      description={t("importHint")}
      trigger={
        <Button size="sm" variant="secondary">
          <Upload /> {t("import")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <a href={templateHref} download="flipwise-comparables-template.csv" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <Download className="size-4" /> {t("downloadTemplate")}
        </a>
        <Field label={t("chooseFile")} htmlFor="csv-file">
          <Input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            className="py-2"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              start(async () => {
                const res = await importComparablesCsv(projectId, file.name, text);
                if (!res.ok) return void toast.error(res.error);
                setResult(res.data!);
                router.refresh();
              });
            }}
          />
        </Field>
        {result ? (
          <>
            <Alert tone={result.imported ? "success" : "warning"} title={t("importDone", { count: result.imported })}>
              {result.errors.length ? t("importErrors", { count: result.errors.length }) : null}
            </Alert>
            {result.errors.length ? (
              <ul className="max-h-40 overflow-y-auto text-xs text-danger">
                {result.errors.map((er) => (
                  <li key={er.line}>
                    {t("line", { line: er.line })}: {er.message}
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

export function RefreshMarketButton({ projectId }: { projectId: string }) {
  const t = useTranslations("market");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await refreshMarketTrend(projectId);
          if (!res.ok) toast.error(res.error);
          router.refresh();
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : ""} /> {t("refresh")}
    </Button>
  );
}

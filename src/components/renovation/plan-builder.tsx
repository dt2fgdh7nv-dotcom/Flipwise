"use client";
import { Plus, RefreshCw, Search, Trash2, Undo2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Stat } from "@/components/shared/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, UnitInput } from "@/components/ui/input";
import type { Certification, CostCategory, CostUnit, QualityTier } from "@/lib/costs/seed-catalogue";
import { formatEur, parseEurToCents } from "@/lib/format";
import { lineTotals, tierPrice, type Totals } from "@/lib/renovation/estimate";
import { DEFAULT_ROOM_AREA, ROOM_TYPES, type RoomType } from "@/lib/renovation/templates";
import { cn } from "@/lib/utils";
import { addLine, addRoom, applyPlanToDeal, deleteLine, deleteRoom, refreshPlanPrices, setPlanTier, updateLine } from "@/server/actions/renovation";

const TIERS: QualityTier[] = ["budget", "mid", "premium"];

export interface PlanLineView {
  id: string;
  name: string;
  code: string | null;
  unit: CostUnit;
  quantity: number;
  tier: QualityTier;
  unitPrice: number;
  unitPriceLow: number;
  unitPriceHigh: number;
  priceOverridden: boolean;
  laborBps: number;
  certification: Certification | null;
  needsRenovationNotice: boolean;
  source: string;
}

export interface PlanRoomView {
  id: string;
  name: string;
  roomType: RoomType;
  areaM2: number | null;
  lines: PlanLineView[];
}

export interface CatalogueOption {
  id: string;
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
  certification: Certification | null;
}

interface Money {
  /** Convert stored cents (excl. VAT) to displayed cents. */
  show: (c: number) => number;
  /** Convert displayed cents back to stored cents. */
  store: (c: number) => number;
  label: string;
}

function useMoney(vatDisplay: "excl" | "incl", vatBps: number): Money {
  const t = useTranslations("renovation");
  const f = 1 + vatBps / 10_000;
  return vatDisplay === "incl"
    ? { show: (c) => Math.round(c * f), store: (c) => Math.round(c / f), label: t("inclVat", { rate: `${vatBps / 100} %` }) }
    : { show: (c) => c, store: (c) => c, label: t("exclVat") };
}

export function PlanSummary({
  projectId,
  totals,
  tier,
  vatDisplay,
  vatBps,
  dealExpectedBudget,
  hasLines,
}: {
  projectId: string;
  totals: Totals;
  tier: QualityTier;
  vatDisplay: "excl" | "incl";
  vatBps: number;
  dealExpectedBudget: number | null;
  hasLines: boolean;
}) {
  const t = useTranslations("renovation");
  const tt = useTranslations("tier");
  const router = useRouter();
  const [pending, start] = useTransition();
  const m = useMoney(vatDisplay, vatBps);
  const matches = dealExpectedBudget !== null && Math.abs(dealExpectedBudget - totals.total) < 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("total")} value={formatEur(m.show(totals.total))} hint={`${t("range", { low: formatEur(m.show(totals.low)), high: formatEur(m.show(totals.high)) })} · ${m.label}`} />
        <Stat label={t("labor")} value={formatEur(m.show(totals.labor))} hint={totals.total ? `${Math.round((totals.labor / totals.total) * 100)} %` : undefined} />
        <Stat label={t("materials")} value={formatEur(m.show(totals.materials))} hint={totals.total ? `${Math.round((totals.materials / totals.total) * 100)} %` : undefined} />
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <label htmlFor="plan-tier" className="text-xs font-medium uppercase tracking-wide text-muted">
            {t("tier")}
          </label>
          <Select
            id="plan-tier"
            className="mt-1.5"
            value={tier}
            disabled={pending}
            onChange={(e) =>
              start(async () => {
                const res = await setPlanTier(projectId, e.target.value);
                if (!res.ok) toast.error(res.error);
                router.refresh();
              })
            }
          >
            {TIERS.map((x) => (
              <option key={x} value={x}>
                {tt(x)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">{t("tierHint")}</p>
        </div>
      </div>
      {hasLines ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {matches ? t("dealMatches") : dealExpectedBudget !== null ? t("dealDiffers", { deal: formatEur(m.show(dealExpectedBudget)), plan: formatEur(m.show(totals.total)) }) : t("applyHint")}
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await refreshPlanPrices(projectId);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(t("refreshed", { count: res.data!.updated }));
                  router.refresh();
                })
              }
            >
              <RefreshCw /> {t("refreshPrices")}
            </Button>
            <Button
              size="sm"
              variant={matches ? "secondary" : "primary"}
              disabled={pending}
              title={t("applyHint")}
              onClick={() =>
                start(async () => {
                  const res = await applyPlanToDeal(projectId);
                  if (!res.ok) return void toast.error(res.error);
                  const d = res.data!;
                  toast.success(t("applied", { best: formatEur(m.show(d.best)), expected: formatEur(m.show(d.expected)), worst: formatEur(m.show(d.worst)) }));
                  router.refresh();
                })
              }
            >
              {t("applyToDeal")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AddRoomButton({ projectId, defaultTier }: { projectId: string; defaultTier: QualityTier }) {
  const t = useTranslations("renovation");
  const tr = useTranslations("roomType");
  const tt = useTranslations("tier");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [f, setF] = useState({ roomType: "kitchen" as RoomType, name: "", area: "", includeTypical: true, tier: defaultTier });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setF({ roomType: "kitchen", name: "", area: "", includeTypical: true, tier: defaultTier });
      }}
      title={t("addRoom")}
      trigger={
        <Button>
          <Plus /> {t("addRoom")}
        </Button>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const area = f.area.trim() ? Number(f.area.replace(",", ".")) : null;
          start(async () => {
            const res = await addRoom(projectId, { roomType: f.roomType, name: f.name || tr(f.roomType), areaM2: area, includeTypical: f.includeTypical, tier: f.tier });
            if (!res.ok) return void toast.error(res.error);
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <Field className="col-span-2" label={t("roomType")} htmlFor="room-type">
          <Select id="room-type" value={f.roomType} onChange={(e) => setF({ ...f, roomType: e.target.value as RoomType })}>
            {ROOM_TYPES.map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("roomName")} htmlFor="room-name">
          <Input id="room-name" placeholder={tr(f.roomType)} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t("area")} hint={t("areaHint")} htmlFor="room-area">
          <UnitInput unit="m²" id="room-area" placeholder={String(DEFAULT_ROOM_AREA[f.roomType])} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} />
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.includeTypical} onChange={(e) => setF({ ...f, includeTypical: e.target.checked })} />
          <Wand2 className="size-4 text-primary" /> {t("includeTypical")}
        </label>
        {f.includeTypical ? (
          <Field className="col-span-2" label={t("tier")} htmlFor="room-tier">
            <Select id="room-tier" value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value as QualityTier })}>
              {TIERS.map((x) => (
                <option key={x} value={x}>
                  {tt(x)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Button type="submit" className="col-span-2" disabled={pending}>
          {pending ? tc("saving") : t("addRoom")}
        </Button>
      </form>
    </Dialog>
  );
}

export function RoomCard({
  projectId,
  room,
  totals,
  catalogue,
  defaultTier,
  vatDisplay,
  vatBps,
}: {
  projectId: string;
  room: PlanRoomView;
  totals: Totals;
  catalogue: CatalogueOption[];
  defaultTier: QualityTier;
  vatDisplay: "excl" | "incl";
  vatBps: number;
}) {
  const t = useTranslations("renovation");
  const tr = useTranslations("roomType");
  const router = useRouter();
  const [pending, start] = useTransition();
  const m = useMoney(vatDisplay, vatBps);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{room.name}</CardTitle>
          <p className="text-xs text-muted">
            {tr(room.roomType)}
            {room.areaM2 ? ` · ${room.areaM2} m²` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="font-semibold tabular">{formatEur(m.show(totals.total))}</p>
            <p className="text-xs text-muted tabular">
              {formatEur(m.show(totals.low))} – {formatEur(m.show(totals.high))}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("deleteRoom")}
            disabled={pending}
            onClick={() => {
              if (!confirm(t("deleteRoomConfirm"))) return;
              start(async () => {
                const res = await deleteRoom(projectId, room.id);
                if (!res.ok) toast.error(res.error);
                router.refresh();
              });
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {room.lines.length === 0 ? <p className="mb-3 text-sm text-muted">{t("emptyRoom")}</p> : null}
        <ul className="divide-y divide-border">
          {room.lines.map((l) => (
            <LineRow key={`${l.id}-${l.quantity}-${l.unitPrice}-${l.tier}`} projectId={projectId} line={l} money={m} />
          ))}
        </ul>
        <AddItemButton projectId={projectId} roomId={room.id} roomArea={room.areaM2} catalogue={catalogue} defaultTier={defaultTier} money={m} />
      </CardContent>
    </Card>
  );
}

function LineRow({ projectId, line, money }: { projectId: string; line: PlanLineView; money: Money }) {
  const t = useTranslations("renovation");
  const tu = useTranslations("costUnit");
  const tt = useTranslations("tier");
  const tcert = useTranslations("certification");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [qty, setQty] = useState(String(line.quantity));
  const [price, setPrice] = useState(String(money.show(line.unitPrice) / 100));
  const totals = lineTotals(line);

  const save = (input: Record<string, unknown>) =>
    start(async () => {
      const res = await updateLine(projectId, line.id, input);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });

  return (
    <li className={cn("relative grid grid-cols-2 gap-x-2 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_7rem_7rem_6.5rem_auto] sm:items-center sm:gap-x-3", pending && "opacity-60")}>
      <div className="col-span-2 min-w-0 pr-10 sm:col-span-1 sm:pr-0">
        <p className="text-sm">{line.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {line.certification ? (
            <Badge tone="warning" title={tcert(`${line.certification}.detail`)}>
              {tcert(`${line.certification}.label`)}
            </Badge>
          ) : null}
          {line.needsRenovationNotice ? <Badge tone="info">{t("noticeBadge")}</Badge> : null}
          {line.priceOverridden ? <Badge>{t("customPrice")}</Badge> : null}
          <span className="truncate">{line.source}</span>
        </p>
      </div>
      <UnitInput
        unit={tu(line.unit)}
        aria-label={t("quantity")}
        className="h-9 px-2 pr-12 text-right"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        onBlur={() => {
          const n = Number(qty.replace(",", "."));
          if (Number.isFinite(n) && n > 0 && n !== line.quantity) save({ quantity: n });
          else setQty(String(line.quantity));
        }}
      />
      <Select aria-label={t("tier")} className="h-9" value={line.tier} onChange={(e) => save({ tier: e.target.value })}>
        {TIERS.map((x) => (
          <option key={x} value={x}>
            {tt(x)}
          </option>
        ))}
      </Select>
      <div className="flex items-center gap-1">
        <UnitInput
          unit="€"
          aria-label={t("unitPrice")}
          className="h-9 px-2 pr-6 text-right"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => {
            const c = parseEurToCents(price);
            if (c !== null && c !== money.show(line.unitPrice)) save({ unitPrice: money.store(c) });
            else setPrice(String(money.show(line.unitPrice) / 100));
          }}
        />
        {line.priceOverridden ? (
          <button type="button" title={t("resetPrice")} aria-label={t("resetPrice")} className="text-muted hover:text-foreground" onClick={() => save({ unitPrice: null })}>
            <Undo2 className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="text-right text-sm tabular">
        <p className="font-medium">{formatEur(money.show(totals.total))}</p>
        <p className="text-xs text-muted">
          {formatEur(money.show(totals.low))}–{formatEur(money.show(totals.high)).replace("€", "")}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={tc("remove")}
        className="absolute right-0 top-2 sm:static"
        onClick={() =>
          start(async () => {
            const res = await deleteLine(projectId, line.id);
            if (!res.ok) toast.error(res.error);
            router.refresh();
          })
        }
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function AddItemButton({
  projectId,
  roomId,
  roomArea,
  catalogue,
  defaultTier,
  money,
}: {
  projectId: string;
  roomId: string;
  roomArea: number | null;
  catalogue: CatalogueOption[];
  defaultTier: QualityTier;
  money: Money;
}) {
  const t = useTranslations("renovation");
  const tcat = useTranslations("costCategory");
  const tu = useTranslations("costUnit");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return catalogue.filter((c) => !s || c.nameEn.toLowerCase().includes(s) || (c.nameFi ?? "").toLowerCase().includes(s) || c.code.includes(s));
  }, [q, catalogue]);
  const groups = [...new Set(filtered.map((c) => c.category))];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setQ("");
      }}
      title={t("addItem")}
      trigger={
        <Button variant="ghost" size="sm" className="mt-2">
          <Plus /> {t("addItem")}
        </Button>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input autoFocus className="pl-9" placeholder={t("searchItems")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-[55dvh] overflow-y-auto">
        {groups.map((g) => (
          <div key={g} className="mb-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{tcat(g)}</p>
            <ul>
              {filtered
                .filter((c) => c.category === g)
                .map((c) => {
                  const p = tierPrice(c, defaultTier);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={pending}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-muted"
                        onClick={() =>
                          start(async () => {
                            const quantity = c.unit === "m2" && roomArea ? roomArea : 1;
                            const res = await addLine(projectId, roomId, { costItemId: c.id, quantity, tier: defaultTier });
                            if (!res.ok) return void toast.error(res.error);
                            setOpen(false);
                            router.refresh();
                          })
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{c.nameEn}</span>
                          {c.nameFi ? <span className="block truncate text-xs italic text-muted">{c.nameFi}</span> : null}
                        </span>
                        <span className="shrink-0 text-right text-xs text-muted tabular">
                          {formatEur(money.show(p.typical))} / {tu(c.unit)}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

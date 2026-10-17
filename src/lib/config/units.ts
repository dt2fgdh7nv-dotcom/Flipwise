import { formatBps, formatEur } from "@/lib/format";
import type { ConfigKey, ConfigUnit } from "./definitions";

/** Message key for a config key (next-intl treats dots as nesting). */
export const configLabelKey = (key: ConfigKey) => key.replaceAll(".", "_");

export function formatConfigValue(value: number, unit: ConfigUnit) {
  if (unit === "bps") return formatBps(value);
  if (unit === "cents") return formatEur(value);
  if (unit === "years") return `${value} years`;
  return String(value);
}

export const configUnitLabel = (unit: ConfigUnit) => (unit === "bps" ? "%" : unit === "cents" ? "€" : unit === "years" ? "years" : "year");

export function configToInput(value: number, unit: ConfigUnit) {
  if (unit === "bps") return String(value / 100);
  if (unit === "cents") return String(value / 100);
  return String(value);
}

export function configFromInput(input: string, unit: ConfigUnit): number | null {
  const n = Number(input.trim().replace(",", ".").replace(/\s/g, ""));
  if (!input.trim() || !Number.isFinite(n)) return null;
  if (unit === "bps" || unit === "cents") return Math.round(n * 100);
  return Math.round(n);
}

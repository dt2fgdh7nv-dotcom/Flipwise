/** Formatting helpers. Money in cents, rates in bps. Locale-aware for future fi/sv UI. */

const eurFmt = (locale: string, digits: number) =>
  new Intl.NumberFormat(locale === "en" ? "en-IE" : locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export function formatEur(cents: number | null | undefined, opts: { decimals?: number; locale?: string; sign?: boolean } = {}) {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return "—";
  const s = eurFmt(opts.locale ?? "en", opts.decimals ?? 0).format(cents / 100);
  return opts.sign && cents > 0 ? `+${s}` : s;
}

export function formatPct(fraction: number | null | undefined, digits = 1) {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(digits)} %`;
}

export const formatBps = (bps: number | null | undefined, digits = 2) =>
  bps === null || bps === undefined ? "—" : `${(bps / 100).toFixed(digits).replace(/\.?0+$/, "")} %`;

export function formatNumber(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: digits }).format(n);
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Helsinki" }).format(date);
}

/** Parse "239 000", "239,000.50" or Finnish "239 000,50" into cents. Returns null if empty/invalid. */
export function parseEurToCents(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().replace(/[€\s ]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else if (s.includes(",")) {
    const parts = s.split(",");
    s = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join("");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Parse a percentage like "1,5" or "1.5" into bps. */
export function parsePctToBps(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace("%", "").replace(",", ".").replace(/\s/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export const centsToInput = (c: number | null | undefined) => (c === null || c === undefined ? "" : String(c / 100));
export const bpsToInput = (b: number | null | undefined) => (b === null || b === undefined ? "" : String(b / 100));

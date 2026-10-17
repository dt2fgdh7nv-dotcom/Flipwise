"use client";
import { useTranslations } from "next-intl";
import type { AssumptionCode } from "@/lib/finance/deal-engine";

export function AssumptionsList({ codes }: { codes: AssumptionCode[] }) {
  const t = useTranslations("assumptions");
  if (!codes.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
      {codes.map((c) => (
        <li key={c}>{t(c)}</li>
      ))}
    </ul>
  );
}

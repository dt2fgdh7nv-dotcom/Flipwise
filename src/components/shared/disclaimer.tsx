import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/** Mandatory disclaimer shown wherever estimates, tax rates or cost data appear. */
export async function Disclaimer({ variant = "short", className }: { variant?: "short" | "long"; className?: string }) {
  const t = await getTranslations("disclaimer");
  return (
    <p className={cn("flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning", className)}>
      <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{t(variant)}</span>
    </p>
  );
}

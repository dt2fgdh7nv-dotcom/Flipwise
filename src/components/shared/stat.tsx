import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, tone, className }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; tone?: "positive" | "negative"; className?: string }) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-border bg-surface p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular", tone === "positive" && "text-success", tone === "negative" && "text-danger")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

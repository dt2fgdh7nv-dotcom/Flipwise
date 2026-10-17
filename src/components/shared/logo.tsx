import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect width="24" height="24" rx="6" fill="var(--primary)" />
        <path d="M6 17V9.5L12 5l6 4.5V17h-4v-4h-4v4z" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      FlipWise
    </span>
  );
}

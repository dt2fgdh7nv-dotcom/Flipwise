"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { seg: "", key: "overview" },
  { seg: "deal", key: "deal" },
  { seg: "housing-company", key: "housingCompany" },
  { seg: "comparables", key: "comparables" },
  { seg: "renovation", key: "renovation" },
  { seg: "ai", key: "ai", phase: 3 },
  { seg: "photos", key: "photos", phase: 4 },
  { seg: "tasks", key: "tasks", phase: 5 },
  { seg: "sharing", key: "sharing" },
] as const;

export function ProjectTabs({ projectId }: { projectId: string }) {
  const t = useTranslations("projects.tabs");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const base = `/app/projects/${projectId}`;
  return (
    <nav className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0" aria-label="Project sections">
      <ul className="flex gap-1">
        {TABS.map((tab) => {
          const href = tab.seg ? `${base}/${tab.seg}` : base;
          const active = tab.seg ? pathname.startsWith(href) : pathname === base;
          const phase = "phase" in tab ? tab.phase : undefined;
          return (
            <li key={tab.key} className="shrink-0">
              {phase ? (
                <span title={tc("comingInPhase", { phase })} className="block cursor-not-allowed px-3 py-2.5 text-sm text-muted/60">
                  {t(tab.key)}
                </span>
              ) : (
                <Link
                  href={href}
                  className={cn(
                    "block border-b-2 px-3 py-2.5 text-sm transition-colors",
                    active ? "border-primary font-medium text-foreground" : "border-transparent text-muted hover:text-foreground",
                  )}
                >
                  {t(tab.key)}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

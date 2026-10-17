"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app/settings", key: "workspace" },
  { href: "/app/settings/members", key: "members" },
  { href: "/app/settings/config", key: "config" },
  { href: "/app/settings/account", key: "account" },
] as const;

export function SettingsNav() {
  const t = useTranslations("settings.nav");
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {ITEMS.map((i) => {
          const active = i.href === "/app/settings" ? pathname === i.href : pathname.startsWith(i.href);
          return (
            <li key={i.href} className="shrink-0">
              <Link href={i.href} className={cn("block border-b-2 px-3 py-2.5 text-sm", active ? "border-primary font-medium" : "border-transparent text-muted hover:text-foreground")}>
                {t(i.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

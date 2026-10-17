"use client";
import { Building2, Calculator, FolderKanban, HardHat, LayoutDashboard, LogOut, Menu, Settings, Shield, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Logo } from "@/components/shared/logo";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { switchWorkspace } from "./actions";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; phase?: number };

export function AppNav({
  user,
  org,
  orgs,
  isPlatformAdmin,
  hasShares,
}: {
  user: { name: string; email: string };
  org: { id: string; name: string; planTier: string };
  orgs: { id: string; name: string }[];
  isPlatformAdmin: boolean;
  hasShares: boolean;
}) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    { href: "/app", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/app/projects", label: t("projects"), icon: FolderKanban },
    { href: "/app/costs", label: t("costDatabase"), icon: Calculator },
    { href: "/app/contractors", label: t("contractors"), icon: HardHat, phase: 5 },
    { href: "/app/settings", label: t("settings"), icon: Settings },
  ];
  if (isPlatformAdmin) items.push({ href: "/admin", label: t("admin"), icon: Shield });
  if (hasShares) items.push({ href: "/portal", label: t("portal"), icon: Building2 });

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  const signOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  const nav = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 px-2 pt-2">
        <Logo />
      </div>
      <div className="mb-3 px-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{t("workspace")}</p>
        {orgs.length > 1 ? (
          <select
            className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
            value={org.id}
            onChange={async (e) => {
              await switchWorkspace(e.target.value);
              router.refresh();
            }}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-0.5 truncate text-sm font-medium">{org.name}</p>
        )}
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">{org.planTier} plan</p>
      </div>
      {items.map(({ href, label, icon: Icon, phase }) =>
        phase ? (
          <span key={href} className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted/70" title={tc("comingInPhase", { phase })}>
            <Icon className="size-4" />
            {label}
            <span className="ml-auto rounded bg-surface-muted px-1.5 text-[10px]">P{phase}</span>
          </span>
        ) : (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(href) ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-surface-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ),
      )}
      <div className="mt-auto border-t border-border px-2 pt-3">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
        <button onClick={signOut} className="mt-2 flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <LogOut className="size-4" />
          {tc("signOut")}
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface lg:block">{nav}</aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} aria-label={t("menu")} className="rounded-md p-2 hover:bg-surface-muted">
          <Menu className="size-5" />
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-md p-2 hover:bg-surface-muted" aria-label="Close">
              <X className="size-5" />
            </button>
            {nav}
          </div>
        </div>
      ) : null}
    </>
  );
}

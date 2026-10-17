import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PortalUserMenu } from "@/components/app/portal-user-menu";
import { Logo } from "@/components/shared/logo";
import { getOrgContext, requireUser } from "@/server/authz";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const ctx = await getOrgContext();
  const t = await getTranslations("portal");
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/portal">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            {ctx ? (
              <Link href="/app" className="hidden text-sm text-primary hover:underline sm:inline">
                {t("goToWorkspace")}
              </Link>
            ) : null}
            {user.isPlatformAdmin ? (
              <Link href="/admin" className="text-sm text-primary hover:underline">
                Platform admin
              </Link>
            ) : null}
            <PortalUserMenu name={user.name} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalUserMenu } from "@/components/app/portal-user-menu";
import { Logo } from "@/components/shared/logo";
import { getOrgContext, requireUser } from "@/server/authz";

/** Platform admin area — separate from tenant workspaces. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin) notFound();
  const ctx = await getOrgContext();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/admin">
            <Logo />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {ctx ? (
              <Link href="/app" className="text-primary hover:underline">
                Workspace
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

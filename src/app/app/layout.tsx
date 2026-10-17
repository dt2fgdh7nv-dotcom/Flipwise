import { and, eq } from "drizzle-orm";
import { AppNav } from "@/components/app/app-nav";
import { db } from "@/db";
import { projectShare } from "@/db/schema";
import { listMemberships, requireOrg } from "@/server/authz";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const [orgs, share] = await Promise.all([
    listMemberships(ctx.user.id),
    db.query.projectShare.findFirst({ where: and(eq(projectShare.userId, ctx.user.id), eq(projectShare.status, "active")), columns: { id: true } }),
  ]);
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AppNav
        user={{ name: ctx.user.name, email: ctx.user.email }}
        org={{ id: ctx.org.id, name: ctx.org.name, planTier: ctx.org.planTier }}
        orgs={orgs}
        isPlatformAdmin={ctx.user.isPlatformAdmin}
        hasShares={Boolean(share)}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

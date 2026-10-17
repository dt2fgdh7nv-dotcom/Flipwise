import { and, asc, eq, gt } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { MembersPanel } from "@/components/settings/members-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { invitation, member, user } from "@/db/schema";
import { hasRole, requireOrg, type OrgRole } from "@/server/authz";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  const ctx = await requireOrg();
  const t = await getTranslations("settings");
  const [members, invites] = await Promise.all([
    db
      .select({ id: member.id, userId: member.userId, role: member.role, name: user.name, email: user.email })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, ctx.org.id))
      .orderBy(asc(member.createdAt)),
    db
      .select({ id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt })
      .from(invitation)
      .where(and(eq(invitation.organizationId, ctx.org.id), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date()))),
  ]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("members")}</CardTitle>
        <CardDescription>{t("membersHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <MembersPanel
          members={members.map((m) => ({ ...m, role: m.role as OrgRole }))}
          invites={invites}
          currentUserId={ctx.user.id}
          canManage={hasRole(ctx, "admin")}
          isOwner={ctx.role === "owner"}
        />
      </CardContent>
    </Card>
  );
}

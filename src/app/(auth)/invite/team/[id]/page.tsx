import { and, eq, gt } from "drizzle-orm";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { invitation, organization } from "@/db/schema";
import { getCurrentUser } from "@/server/authz";
import { SignOutAndRetry } from "../../project/[token]/accept";
import { JoinTeamButton } from "./join";

export const metadata = { title: "Join workspace", robots: { index: false } };

export default async function TeamInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("invite");
  const tr = await getTranslations("roles");
  const [inv] = await db
    .select({ id: invitation.id, email: invitation.email, role: invitation.role, orgName: organization.name })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(and(eq(invitation.id, id), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())))
    .limit(1);
  if (!inv) return <Alert tone="warning">{t("teamInvalid")}</Alert>;
  const me = await getCurrentUser();
  const next = `/invite/team/${id}`;
  const role = tr((inv.role ?? "member") as "member");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("teamTitle")}</CardTitle>
        <CardDescription>{t("teamBody", { org: inv.orgName, role })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t("sentTo", { email: inv.email })}</p>
        {!me ? (
          <>
            <Button asChild size="lg">
              <Link href={`/sign-up?next=${encodeURIComponent(next)}&email=${encodeURIComponent(inv.email)}`}>{t("createAccount")}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/sign-in?next=${encodeURIComponent(next)}&email=${encodeURIComponent(inv.email)}`}>{t("signInToAccept")}</Link>
            </Button>
          </>
        ) : me.email.toLowerCase() !== inv.email.toLowerCase() ? (
          <>
            <Alert tone="warning">{t("wrongAccount", { current: me.email, email: inv.email })}</Alert>
            <SignOutAndRetry next={next} email={inv.email} />
          </>
        ) : (
          <JoinTeamButton invitationId={inv.id} label={t("join")} />
        )}
      </CardContent>
    </Card>
  );
}

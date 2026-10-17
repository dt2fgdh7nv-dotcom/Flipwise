import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/server/authz";
import { findShareByToken } from "@/server/data/sharing";
import { AcceptShareButton, SignOutAndRetry } from "./accept";

export const metadata = { title: "Invitation", robots: { index: false } };

export default async function ProjectInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const found = await findShareByToken(token);
  if (!found) return <Alert tone="warning">{t("invalid")}</Alert>;
  const me = await getCurrentUser();
  const next = `/invite/project/${token}`;
  const email = found.share.email;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("projectTitle")}</CardTitle>
        <CardDescription>{t("projectBody", { org: found.orgName, project: found.projectName })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t("sentTo", { email })}</p>
        {!me ? (
          <>
            <Button asChild size="lg">
              <Link href={`/sign-up?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`}>{t("createAccount")}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/sign-in?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`}>{t("signInToAccept")}</Link>
            </Button>
          </>
        ) : me.email.toLowerCase() !== email.toLowerCase() ? (
          <>
            <Alert tone="warning">{t("wrongAccount", { current: me.email, email })}</Alert>
            <SignOutAndRetry next={next} email={email} />
          </>
        ) : (
          <AcceptShareButton token={token} label={t("accept")} />
        )}
      </CardContent>
    </Card>
  );
}

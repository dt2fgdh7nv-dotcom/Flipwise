import { desc, eq } from "drizzle-orm";
import { Eye, EyeOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ShareInviteForm, ShareList } from "@/components/projects/sharing-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { projectShare } from "@/db/schema";
import { requireProjectAccess } from "@/server/authz";

export const metadata = { title: "Sharing" };

export default async function SharingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "edit");
  const shares = await db.select().from(projectShare).where(eq(projectShare.projectId, id)).orderBy(desc(projectShare.createdAt));
  const t = await getTranslations("sharing");
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ShareInviteForm projectId={id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("shares")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ShareList projectId={id} shares={shares.map((s) => ({ id: s.id, email: s.email, role: s.role, status: s.status, expiresAt: s.expiresAt, acceptedAt: s.acceptedAt }))} />
          </CardContent>
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t("whatClientsSee")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="flex gap-2">
            <Eye className="mt-0.5 size-4 shrink-0 text-success" /> {t("clientSees")}
          </p>
          <p className="flex gap-2 text-muted">
            <EyeOff className="mt-0.5 size-4 shrink-0" /> {t("clientDoesNotSee")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

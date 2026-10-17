"use server";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { projectShare } from "@/db/schema";
import { runAction, type ActionResult } from "@/server/action";
import { audit } from "@/server/audit";
import { assertProjectAccess, ForbiddenError, requireUser } from "@/server/authz";
import { findShareByToken, hashToken } from "@/server/data/sharing";
import { sendMail } from "@/server/mailer";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function createShare(projectId: string, input: unknown): Promise<ActionResult<{ link: string }>> {
  return runAction(async () => {
    const access = await assertProjectAccess(projectId, "edit");
    if (access.kind !== "member") throw new ForbiddenError();
    const { email, role, expiresInDays } = z
      .object({ email: z.email().transform((e) => e.trim().toLowerCase()), role: z.enum(["viewer", "commenter"]), expiresInDays: z.number().int().min(1).max(365) })
      .parse(input);
    if (email === access.user.email.toLowerCase()) return { ok: false, error: "You already have access to this project." };
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);
    await db
      .insert(projectShare)
      .values({ projectId, organizationId: access.project.organizationId, email, role, status: "pending", tokenHash, invitedBy: access.user.id, expiresAt, userId: null })
      .onConflictDoUpdate({
        target: [projectShare.projectId, projectShare.email],
        set: { role, status: "pending", tokenHash, invitedBy: access.user.id, expiresAt, userId: null, acceptedAt: null, updatedAt: new Date() },
      });
    const link = `${appUrl()}/invite/project/${token}`;
    await sendMail({
      to: email,
      subject: `${access.user.name} shared “${access.project.name}” with you on FlipWise`,
      body: `${access.user.name} shared a project with you. Open it here (link valid ${expiresInDays} days): ${link}`,
    });
    await audit({ organizationId: access.project.organizationId, actorId: access.user.id, action: "share.create", entityType: "project", entityId: projectId, metadata: { email, role } });
    revalidatePath(`/app/projects/${projectId}/sharing`);
    return { ok: true, data: { link } };
  });
}

export async function revokeShare(projectId: string, shareId: string): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertProjectAccess(projectId, "edit");
    if (access.kind !== "member") throw new ForbiddenError();
    await db
      .update(projectShare)
      .set({ status: "revoked" })
      .where(and(eq(projectShare.id, z.uuid().parse(shareId)), eq(projectShare.projectId, projectId), eq(projectShare.organizationId, access.project.organizationId)));
    await audit({ organizationId: access.project.organizationId, actorId: access.user.id, action: "share.revoke", entityType: "project", entityId: projectId, metadata: { shareId } });
    revalidatePath(`/app/projects/${projectId}/sharing`);
    return { ok: true };
  });
}

export async function acceptShare(token: string): Promise<ActionResult<{ projectId: string }>> {
  return runAction(async () => {
    const me = await requireUser();
    const found = await findShareByToken(token);
    if (!found) return { ok: false, error: "This invitation is invalid or has expired." };
    if (found.share.email.toLowerCase() !== me.email.toLowerCase()) return { ok: false, error: "This invitation was sent to a different email address." };
    if (found.share.userId && found.share.userId !== me.id) return { ok: false, error: "This invitation has already been used." };
    await db.update(projectShare).set({ userId: me.id, status: "active", acceptedAt: new Date() }).where(eq(projectShare.id, found.share.id));
    await audit({ organizationId: found.share.organizationId, actorId: me.id, action: "share.accept", entityType: "project", entityId: found.share.projectId });
    return { ok: true, data: { projectId: found.share.projectId } };
  });
}

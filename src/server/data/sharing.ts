import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { project, projectShare } from "@/db/schema";

/** Share tokens are stored only as SHA-256 hashes. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Look up a pending/active share by raw token (used by the invite page). */
export async function findShareByToken(token: string) {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const share = await db.query.projectShare.findFirst({ where: eq(projectShare.tokenHash, hashToken(token)) });
  if (!share || share.status === "revoked" || share.expiresAt < new Date()) return null;
  const p = await db.query.project.findFirst({ where: eq(project.id, share.projectId), with: { organization: { columns: { name: true } } } });
  return p ? { share, projectName: p.name, orgName: p.organization.name } : null;
}


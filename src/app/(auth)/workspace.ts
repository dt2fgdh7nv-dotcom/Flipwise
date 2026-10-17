"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/server/auth";
import { requireUser } from "@/server/authz";
import { audit } from "@/server/audit";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** Create a workspace (tenant) for the signed-in user and make it active. */
export async function createWorkspace(name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.string().trim().min(2).max(80).safeParse(name);
  if (!parsed.success) return { ok: false, error: "Workspace name must be 2–80 characters." };
  const user = await requireUser();
  const slug = `${slugify(parsed.data) || "workspace"}-${Math.random().toString(36).slice(2, 7)}`;
  const org = await auth.api.createOrganization({ body: { name: parsed.data, slug }, headers: await headers() });
  if (!org) return { ok: false, error: "Could not create workspace." };
  await auth.api.setActiveOrganization({ body: { organizationId: org.id }, headers: await headers() });
  await audit({ organizationId: org.id, actorId: user.id, action: "organization.create", entityType: "organization", entityId: org.id });
  return { ok: true };
}

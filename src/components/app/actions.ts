"use server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { listMemberships, requireUser } from "@/server/authz";

export async function switchWorkspace(organizationId: string) {
  const user = await requireUser();
  const memberships = await listMemberships(user.id);
  if (!memberships.some((m) => m.id === organizationId)) return;
  await auth.api.setActiveOrganization({ body: { organizationId }, headers: await headers() });
}

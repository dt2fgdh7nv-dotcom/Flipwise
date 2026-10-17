import "server-only";
import { and, asc, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { member, organization, project, projectShare } from "@/db/schema";
import { auth } from "./auth";

/*
 * Data Access Layer for authorization. Every server action, route handler and page that
 * touches tenant data must go through one of these helpers. Queries must then filter by the
 * organization id returned here — never by an id taken from the client.
 */

export type OrgRole = "owner" | "admin" | "member";
export type ProjectAccessLevel = "view" | "comment" | "edit";

const ROLE_RANK: Record<OrgRole, number> = { member: 1, admin: 2, owner: 3 };

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const s = await getSession();
  if (!s) return null;
  const u = s.user as typeof s.user & { isPlatformAdmin?: boolean };
  return { id: u.id, name: u.name, email: u.email, isPlatformAdmin: Boolean(u.isPlatformAdmin) };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export interface OrgContext {
  user: SessionUser;
  org: typeof organization.$inferSelect;
  role: OrgRole;
}

/** Resolve the active organization: the session's active org if the user is still a member, else the first membership. */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const s = await getSession();
  const user = await getCurrentUser();
  if (!s || !user) return null;
  const memberships = await db
    .select({ role: member.role, org: organization })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, user.id))
    .orderBy(asc(member.createdAt));
  if (memberships.length === 0) return null;
  const activeId = s.session.activeOrganizationId;
  const m = memberships.find((x) => x.org.id === activeId) ?? memberships[0];
  return { user, org: m.org, role: m.role as OrgRole };
});

export async function listMemberships(userId: string) {
  return db
    .select({ id: organization.id, name: organization.name, role: member.role })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.name));
}

/** For server actions: throws ForbiddenError. */
export async function assertOrg(minRole: OrgRole = "member"): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) throw new ForbiddenError("Not a member of any workspace");
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minRole]) throw new ForbiddenError("Insufficient role");
  return ctx;
}

/** For pages: redirects users without a workspace to the client portal / onboarding. */
export async function requireOrg(minRole: OrgRole = "member"): Promise<OrgContext> {
  await requireUser();
  const ctx = await getOrgContext();
  if (!ctx) redirect("/portal");
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minRole]) notFound();
  return ctx;
}

export function hasRole(ctx: { role: OrgRole }, minRole: OrgRole) {
  return ROLE_RANK[ctx.role] >= ROLE_RANK[minRole];
}

export async function assertPlatformAdmin() {
  const user = await getCurrentUser();
  if (!user?.isPlatformAdmin) throw new ForbiddenError("Platform admin only");
  return user;
}

export type ProjectAccess =
  | { kind: "member"; user: SessionUser; project: typeof project.$inferSelect; role: OrgRole; level: "edit" }
  | {
      kind: "client";
      user: SessionUser;
      project: typeof project.$inferSelect;
      shareRole: "viewer" | "commenter";
      level: "view" | "comment";
    };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEVEL_RANK: Record<ProjectAccessLevel, number> = { view: 1, comment: 2, edit: 3 };

/**
 * Central project access check.
 * - Members of the owning organization: full edit access.
 * - Clients with an active, unexpired share: view (viewer) or comment (commenter).
 * Throws ForbiddenError otherwise; callers must not reveal whether the project exists.
 */
export async function assertProjectAccess(
  projectId: string,
  need: ProjectAccessLevel,
): Promise<ProjectAccess> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Not signed in");
  return resolveProjectAccess(user, projectId, need);
}

/** Core access rule, independent of the request (unit-tested against the database). */
export async function resolveProjectAccess(
  user: SessionUser,
  projectId: string,
  need: ProjectAccessLevel,
): Promise<ProjectAccess> {
  if (!UUID_RE.test(projectId)) throw new ForbiddenError("Not found");

  const [p] = await db.select().from(project).where(eq(project.id, projectId)).limit(1);
  if (!p) throw new ForbiddenError("Not found");

  const [m] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, p.organizationId), eq(member.userId, user.id)))
    .limit(1);
  if (m) return { kind: "member", user, project: p, role: m.role as OrgRole, level: "edit" };

  const [share] = await db
    .select({ role: projectShare.role })
    .from(projectShare)
    .where(
      and(
        eq(projectShare.projectId, p.id),
        eq(projectShare.userId, user.id),
        eq(projectShare.status, "active"),
        gt(projectShare.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!share) throw new ForbiddenError("Not found");
  const level = share.role === "commenter" ? "comment" : "view";
  if (LEVEL_RANK[level] < LEVEL_RANK[need]) throw new ForbiddenError("Insufficient access");
  return { kind: "client", user, project: p, shareRole: share.role, level };
}

/** Page variant: unknown or forbidden projects render 404. */
export async function requireProjectAccess(projectId: string, need: ProjectAccessLevel) {
  await requireUser();
  try {
    return await assertProjectAccess(projectId, need);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
}

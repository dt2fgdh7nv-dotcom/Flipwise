/**
 * Integration test against the seeded dev database (pnpm db:seed).
 * Verifies tenant isolation and client share rules in the central access check.
 */
import "dotenv/config";
import { eq, like } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: () => { throw new Error("REDIRECT"); } }));

const { db } = await import("@/db");
const s = await import("@/db/schema");
const { resolveProjectAccess, ForbiddenError } = await import("@/server/authz");

const userByEmail = async (email: string) => {
  const u = await db.query.user.findFirst({ where: eq(s.user.email, email) });
  if (!u) throw new Error(`Seed user ${email} missing — run pnpm db:seed`);
  return { id: u.id, name: u.name, email: u.email, isPlatformAdmin: u.isPlatformAdmin };
};
const projectId = async (name: string) => (await db.query.project.findFirst({ where: like(s.project.name, `${name}%`) }))!.id;

let ids: Record<string, string>;
let users: Record<string, Awaited<ReturnType<typeof userByEmail>>>;

beforeAll(async () => {
  ids = { kallio: await projectId("Kallio"), porvoo: await projectId("Porvoo"), sold: await projectId("Tikkurila"), other: await projectId("Other tenant") };
  users = {
    owner: await userByEmail("demo@flipwise.fi"),
    member: await userByEmail("tuomas@flipwise.fi"),
    client: await userByEmail("client@flipwise.fi"),
    other: await userByEmail("other@flipwise.fi"),
    admin: await userByEmail("admin@flipwise.fi"),
  };
});

const denied = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(ForbiddenError);

describe("resolveProjectAccess", () => {
  it("gives org members edit access", async () => {
    expect((await resolveProjectAccess(users.owner, ids.kallio, "edit")).level).toBe("edit");
    expect((await resolveProjectAccess(users.member, ids.porvoo, "edit")).kind).toBe("member");
  });

  it("isolates tenants", async () => {
    await denied(resolveProjectAccess(users.other, ids.kallio, "view"));
    await denied(resolveProjectAccess(users.owner, ids.other, "view"));
  });

  it("gives clients only what was shared, at the shared level", async () => {
    expect((await resolveProjectAccess(users.client, ids.kallio, "comment")).level).toBe("comment");
    expect((await resolveProjectAccess(users.client, ids.sold, "view")).level).toBe("view");
    await denied(resolveProjectAccess(users.client, ids.sold, "comment"));
    await denied(resolveProjectAccess(users.client, ids.kallio, "edit"));
    await denied(resolveProjectAccess(users.client, ids.porvoo, "view"));
  });

  it("does not grant platform admins tenant data", async () => {
    await denied(resolveProjectAccess(users.admin, ids.kallio, "view"));
  });

  it("rejects malformed ids", async () => {
    await denied(resolveProjectAccess(users.owner, "../../etc", "view"));
  });
});

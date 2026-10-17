/** Workspace price overrides must only affect that workspace (seeded DB required). */
import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

const { db } = await import("@/db");
const s = await import("@/db/schema");
const { getEffectiveCatalogue } = await import("@/server/data/costs");

const orgBySlug = async (slug: string) => (await db.query.organization.findFirst({ where: eq(s.organization.slug, slug) }))!.id;
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await db.delete(s.costItem).where(eq(s.costItem.id, id));
});

describe("cost catalogue scoping", () => {
  it("applies an override only to its own workspace", async () => {
    const demo = await orgBySlug("demo-flips");
    const other = await orgBySlug("other-flips");
    const base = (await db.query.costItem.findFirst({ where: and(isNull(s.costItem.organizationId), eq(s.costItem.code, "flooring.laminate")) }))!;
    const [o] = await db
      .insert(s.costItem)
      .values({ ...base, id: undefined, organizationId: demo, baseItemId: base.id, midLow: 1, midHigh: 2, source: "test override", createdAt: undefined, updatedAt: undefined })
      .returning();
    created.push(o.id);

    const mine = (await getEffectiveCatalogue(demo)).find((c) => c.code === "flooring.laminate")!;
    const theirs = (await getEffectiveCatalogue(other)).find((c) => c.code === "flooring.laminate")!;
    const platform = (await getEffectiveCatalogue(null)).find((c) => c.code === "flooring.laminate")!;
    expect(mine.scope).toBe("override");
    expect(mine.midHigh).toBe(2);
    expect(theirs.scope).toBe("platform");
    expect(theirs.midHigh).toBe(base.midHigh);
    expect(platform.midHigh).toBe(base.midHigh);
  });
});

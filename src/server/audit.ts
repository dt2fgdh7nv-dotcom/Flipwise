import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function audit(entry: {
  organizationId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLog).values({ ...entry, entityId: entry.entityId ?? null, metadata: entry.metadata ?? null });
}

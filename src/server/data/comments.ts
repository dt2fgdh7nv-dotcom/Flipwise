import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { comment, member } from "@/db/schema";
import type { CommentView } from "@/components/projects/comments-thread";

export async function listComments(projectId: string, organizationId: string): Promise<CommentView[]> {
  const [rows, members] = await Promise.all([
    db.query.comment.findMany({ where: eq(comment.projectId, projectId), orderBy: [asc(comment.createdAt)], with: { author: { columns: { name: true, id: true } } } }),
    db.select({ userId: member.userId }).from(member).where(eq(member.organizationId, organizationId)),
  ]);
  const team = new Set(members.map((m) => m.userId));
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    authorName: r.author?.name ?? "Deleted user",
    isClient: r.authorId ? !team.has(r.authorId) : false,
    createdAt: r.createdAt,
  }));
}

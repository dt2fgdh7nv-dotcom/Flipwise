"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { comment } from "@/db/schema";
import { runAction, type ActionResult } from "@/server/action";
import { assertProjectAccess } from "@/server/authz";

/** Team members and clients with "commenter" access can comment. */
export async function addComment(projectId: string, body: string): Promise<ActionResult> {
  return runAction(async () => {
    const access = await assertProjectAccess(projectId, "comment");
    const text = z.string().trim().min(1).max(4000).parse(body);
    await db.insert(comment).values({ projectId, organizationId: access.project.organizationId, authorId: access.user.id, body: text });
    revalidatePath(`/app/projects/${projectId}`);
    revalidatePath(`/portal/projects/${projectId}`);
    return { ok: true };
  });
}

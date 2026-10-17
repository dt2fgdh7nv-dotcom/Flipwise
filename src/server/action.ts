import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ForbiddenError } from "./authz";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** Wrap a server action body: maps auth and validation errors to a serialisable result. */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ForbiddenError) return { ok: false, error: "You don't have access to do that." };
    if (e instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
    }
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

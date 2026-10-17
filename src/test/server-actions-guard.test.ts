/**
 * Static guard: every exported server action must call an authorization helper.
 * Catches the most common multi-tenant bug — a new action that forgets the access check.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const GUARDS = /\b(assertOrg|assertProjectAccess|assertEditor|assertPlatformAdmin|requireUser|requireOrg)\(/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

const actionFiles = walk(ROOT).filter((f) => /^\s*["']use server["']/.test(readFileSync(f, "utf8")));

describe("server actions", () => {
  it("found action files", () => expect(actionFiles.length).toBeGreaterThan(3));

  for (const file of actionFiles) {
    const src = readFileSync(file, "utf8");
    const fns = [...src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)];
    for (const [, name, body] of fns) {
      it(`${path.relative(ROOT, file)} › ${name} checks access`, () => {
        expect(GUARDS.test(body), `${name} must call an authz helper`).toBe(true);
      });
    }
  }
});

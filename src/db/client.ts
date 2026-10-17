import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Database connection.
 * - DATABASE_URL=postgres://…  → PostgreSQL (production, CI)
 * - DATABASE_URL empty or pglite:<dir> → built-in embedded PostgreSQL (PGlite) stored in a local folder,
 *   so the app runs on a laptop without installing a database.
 */
export type DB = NodePgDatabase<typeof schema>;

export const DEFAULT_LOCAL_DB_DIR = ".data/flipwise-db";

export function databaseTarget(url = process.env.DATABASE_URL) {
  if (url && /^postgres(ql)?:\/\//.test(url)) return { kind: "postgres" as const, url };
  const dir = url?.startsWith("pglite:") ? url.slice("pglite:".length) : DEFAULT_LOCAL_DB_DIR;
  return { kind: "pglite" as const, dir: path.resolve(process.cwd(), dir) };
}

export function createDb() {
  const target = databaseTarget();
  if (target.kind === "postgres") {
    const pool = new Pool({ connectionString: target.url, max: 10 });
    return { db: drizzlePg(pool, { schema }), close: () => pool.end(), target };
  }
  mkdirSync(path.dirname(target.dir), { recursive: true });
  const client = new PGlite(target.dir);
  // Same query API as node-postgres; typed as one DB so the app code is driver-agnostic.
  return { db: drizzlePglite(client, { schema }) as unknown as DB, close: () => client.close(), target };
}

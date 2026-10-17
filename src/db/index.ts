import "server-only";
import { createDb, type DB } from "./client";
import * as schema from "./schema";

/*
 * One connection per server process, opened lazily on first use. Lazy matters for the embedded
 * database: Next.js may load server modules in short-lived helper processes (build workers, dev
 * tooling) that never query, and the embedded database must only ever be opened by one process.
 */
const globalForDb = globalThis as unknown as { flipwiseDb?: ReturnType<typeof createDb> };

function conn() {
  globalForDb.flipwiseDb ??= createDb();
  return globalForDb.flipwiseDb.db;
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = conn();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type { DB };
export { schema };

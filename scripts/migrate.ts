/** Apply database migrations (works for PostgreSQL and the built-in local database). */
import "dotenv/config";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { createDb } from "../src/db/client";

async function main() {
  const { db, close, target } = createDb();
  const opts = { migrationsFolder: "./drizzle" };
  if (target.kind === "postgres") await migratePg(db, opts);
  else await migratePglite(db as unknown as Parameters<typeof migratePglite>[0], opts);
  await close();
  console.log(`migrations applied (${target.kind === "postgres" ? "PostgreSQL" : `local database in ${target.dir}`})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

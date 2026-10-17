/**
 * One-step local setup: creates .env (with a random secret) if missing, applies migrations, seeds demo data.
 * Safe to run repeatedly.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

if (!existsSync(".env")) {
  const template = readFileSync(".env.example", "utf8");
  writeFileSync(".env", template.replace("replace-with-openssl-rand-base64-32", randomBytes(32).toString("base64")));
  console.log("created .env");
}

const run = (script: string) => execSync(`"${process.execPath}" --import tsx ${script}`, { stdio: "inherit" });
run("scripts/migrate.ts");
run("scripts/seed.ts");
console.log("\nSetup complete. Start the app and open http://localhost:3000");

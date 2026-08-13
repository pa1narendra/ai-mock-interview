// One-off, idempotent migration for the referral-earned Pro tier.
// Run once:  node apply-referral-pro.mjs
// Safe to re-run: every statement uses IF NOT EXISTS.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      const match = text.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?/m);
      if (match) return match[1].trim();
    } catch {
      /* file missing - try next */
    }
  }
  return null;
}

const url = loadDatabaseUrl();
if (!url) {
  console.error("DATABASE_URL not found (checked env, .env.local, .env).");
  process.exit(1);
}

const sql = neon(url);

const statements = [
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_pro" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referral_code" text`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referred_by" text`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referral_count" integer NOT NULL DEFAULT 0`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referral_credited" boolean NOT NULL DEFAULT false`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_referral_code_uq" ON "user" ("referral_code")`,
];

for (const stmt of statements) {
  await sql.query(stmt);
  console.log("ok:", stmt.slice(0, 60), "...");
}

console.log("\nReferral/Pro columns are ready.");

import "server-only";

import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "@/db/schema";
import { createResilientFetch } from "@/lib/db-fetch";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL - set it in .env.local (see .env.example).");
}

// Retry queries whose connection never got out (DNS or connect failures) and
// log the real cause, which the driver's "fetch failed" otherwise hides.
neonConfig.fetchFunction = createResilientFetch((input, init) => fetch(input, init), {
  log: (message) => console.warn(`[db] ${message}`),
});

const client = neon(process.env.DATABASE_URL);

export const db = drizzle(client, { schema });

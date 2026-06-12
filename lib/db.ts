import "server-only";

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL - set it in .env.local (see .env.example).");
}

const client = neon(process.env.DATABASE_URL);

export const db = drizzle(client, { schema });

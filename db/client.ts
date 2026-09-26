// db/client.ts
//
// Neon HTTP driver — one HTTP request per query, no persistent connection.
// This is required for Vercel serverless: TCP connections are not persistent
// across function invocations, and the HTTP driver is the correct Neon mode
// for this deployment target.
//
// Do NOT switch to neon-serverless (WebSocket) without understanding that
// WebSocket connections behave differently under Vercel's function lifecycle.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local before starting the app."
  );
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });

// Type helper: extract the transaction object type from db.transaction.
// Use this to type the `tx` parameter of functions that MUST run inside
// a transaction (e.g. writeAuditEvent). Passing `db` directly instead of
// `tx` will produce a TypeScript error.
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

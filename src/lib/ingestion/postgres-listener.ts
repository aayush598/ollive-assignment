import { sql } from "drizzle-orm";
import { db } from "../db";

let listening = false;

export async function startIngestionListener() {
  if (listening) return;

  try {
    await db.execute(sql`
      LISTEN inference_log_inserted;
    `);

    listening = true;
    console.log("[ingestion-listener] Listening for inference log inserts via LISTEN/NOTIFY");

    // In a production deployment with a direct Postgres connection (not pooled),
    // this would process NOTIFY payloads as they arrive.
    // For now, the in-process EventEmitter handles real-time event distribution.
  } catch {
    console.debug("[ingestion-listener] Postgres LISTEN/NOTIFY not supported in this driver, falling back to in-process events");
  }
}

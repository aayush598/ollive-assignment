import { sql } from "drizzle-orm";
import { db } from "../db";
import { ingestionEvents } from "./events";

let listening = false;

export async function startIngestionListener() {
  if (listening) return;

  try {
    await db.execute(sql`
      LISTEN inference_log_inserted;
    `);

    listening = true;
    console.log("[ingestion-listener] Listening for inference log inserts via LISTEN/NOTIFY");
  } catch (err) {
    console.debug("[ingestion-listener] Postgres LISTEN/NOTIFY not supported in this driver, falling back to in-process events");
  }
}

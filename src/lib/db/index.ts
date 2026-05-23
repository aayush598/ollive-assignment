import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../env";

const globalPool = globalThis as unknown as { __db?: ReturnType<typeof drizzle>; __client?: postgres.Sql };

function createDb() {
  if (!globalPool.__client) {
    globalPool.__client = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: true,
    });
  }
  if (!globalPool.__db) {
    globalPool.__db = drizzle(globalPool.__client, { schema, casing: "snake_case" });
  }
  return globalPool.__db;
}

export const db = createDb();
export { schema };

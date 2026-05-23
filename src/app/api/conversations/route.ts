import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/api";

export async function GET() {
  try {
    const session = await requireAuth();
    const conversations = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.userId, session.user.id))
      .orderBy(desc(schema.conversations.createdAt));

    return NextResponse.json({ conversations });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

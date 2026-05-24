import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/api";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const rl = await rateLimit(getRateLimitKey(ip, "/api/conversations"), {
      maxRequests: 60,
      windowMs: 60000,
    });

    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(
      Math.max(parseInt(limitParam ?? String(PAGE_SIZE), 10) || PAGE_SIZE, 1),
      100,
    );

    const filters = [
      eq(schema.conversations.userId, session.user.id),
      cursor ? lt(schema.conversations.createdAt, new Date(cursor)) : undefined,
    ].filter(Boolean) as ReturnType<typeof eq>[];

    const conversations = await db
      .select()
      .from(schema.conversations)
      .where(and(...filters))
      .orderBy(desc(schema.conversations.createdAt))
      .limit(limit + 1);

    const hasMore = conversations.length > limit;
    const items = hasMore ? conversations.slice(0, limit) : conversations;
    const nextCursor =
      hasMore && items.length > 0 ? items[items.length - 1].createdAt.toISOString() : null;

    const total = await db.$count(
      schema.conversations,
      eq(schema.conversations.userId, session.user.id),
    );

    return NextResponse.json({
      conversations: items,
      pagination: {
        total,
        limit,
        nextCursor,
        hasMore,
      },
    });
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

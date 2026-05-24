import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schema } from "@/lib/db";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const rl = await rateLimit(getRateLimitKey(ip, "/api/analytics"), {
    maxRequests: 100,
    windowMs: 60000,
  });

  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { type, sessionId, deviceId, url, referrer, userAgent, path, userId, ...rest } = body;

    if (!type) {
      return NextResponse.json({ error: "Missing event type" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    const parsedUrl = url ?? "";
    const parsedPath = path ?? (parsedUrl ? new URL(parsedUrl).pathname : null);

    try {
      await db.insert(schema.analyticsEvents).values({
        id,
        type,
        sessionId: sessionId ?? null,
        deviceId: deviceId ?? null,
        userId: userId ?? null,
        url: parsedUrl || null,
        path: parsedPath,
        referrer: referrer ?? null,
        userAgent: userAgent ?? null,
        data: Object.keys(rest).length > 0 ? rest : null,
      });
    } catch {
      // Table might not exist yet; analytics is best-effort
    }

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "Failed to process analytics event");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

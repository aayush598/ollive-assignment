import { NextRequest, NextResponse } from "next/server";
import { processIngestBatch, getInferenceLogs, getInferenceStats } from "@/lib/ingestion/service";
import { requireAuth } from "@/lib/auth/api";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const { allowed } = await rateLimit(getRateLimitKey(ip, "ingest"), {
      maxRequests: 120,
      windowMs: 60000,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const session = await requireAuth();
    const body = await req.json();
    if (body?.logs?.length) {
      for (const log of body.logs) {
        log.userId = session.user.id;
      }
    }
    const result = await processIngestBatch(body);
    return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 200 });
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

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId") ?? undefined;
    const provider = searchParams.get("provider") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const stats = searchParams.get("stats") === "true";

    if (stats) {
      const statsData = await getInferenceStats({ userId: session.user.id });
      return NextResponse.json(statsData);
    }

    const logs = await getInferenceLogs({
      conversationId,
      userId: session.user.id,
      provider,
      limit,
      offset,
    });

    return NextResponse.json({ logs, total: logs.length });
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

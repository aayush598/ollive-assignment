import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const report = await request.json();
    logger.warn({ cspReport: report }, "CSP violation reported");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    logger.error({ err }, "Failed to parse CSP report");
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

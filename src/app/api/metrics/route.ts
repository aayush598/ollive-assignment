import { NextResponse } from "next/server";
import { getMetricsContentType } from "@/lib/metrics";

export async function GET() {
  try {
    const { content, contentType } = await getMetricsContentType();
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to collect metrics" }, { status: 500 });
  }
}

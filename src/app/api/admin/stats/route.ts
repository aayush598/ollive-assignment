import { getInferenceStats } from "@/lib/ingestion/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const since = new Date(Date.now() - 86400000);
    const stats = await getInferenceStats({ since });

    const hourlyRes = await fetch(
      new URL("/api/admin/stats/hourly", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    ).catch(() => null);

    let hourlyBreakdown = [];
    if (hourlyRes?.ok) {
      hourlyBreakdown = (await hourlyRes.json()).data ?? [];
    }

    return Response.json({
      ...stats,
      hourlyBreakdown,
    });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return Response.json(
      {
        totalRequests: 0,
        totalTokens: 0,
        averageLatencyMs: 0,
        p95LatencyMs: 0,
        successCount: 0,
        errorCount: 0,
        cancelledCount: 0,
        successRate: 100,
        errorRate: 0,
        byProvider: {},
        recentErrors: [],
        requestsPerMinute: 0,
        tokensPerMinute: 0,
        hourlyBreakdown: [],
      },
      { status: 200 },
    );
  }
}

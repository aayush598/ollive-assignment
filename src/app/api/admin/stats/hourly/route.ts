import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await db.execute<{
      hour: string;
      requests: number;
      tokens: number;
      avg_latency: number;
      errors: number;
    }>(sql`
      SELECT
        to_char(created_at, 'YYYY-MM-DD HH24:00') as hour,
        COUNT(*)::int as requests,
        COALESCE(SUM(total_tokens), 0)::int as tokens,
        COALESCE(AVG(latency_ms), 0)::int as avg_latency,
        COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0)::int as errors
      FROM inference_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY to_char(created_at, 'YYYY-MM-DD HH24:00')
      ORDER BY hour ASC
    `);

    return Response.json({ data });
  } catch (error) {
    console.error("Failed to fetch hourly stats:", error);
    return Response.json({ data: [] });
  }
}

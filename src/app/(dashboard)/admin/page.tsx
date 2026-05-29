"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface ByProvider {
  count: number;
  totalTokens: number;
  avgLatencyMs: number;
  errors: number;
}

interface HourlyData {
  hour: string;
  requests: number;
  tokens: number;
  avg_latency: number;
  errors: number;
}

interface StatsData {
  totalRequests: number;
  totalTokens: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  successCount: number;
  errorCount: number;
  cancelledCount: number;
  successRate: number;
  errorRate: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  byProvider: Record<string, ByProvider>;
  recentErrors: Array<{
    id: string;
    provider: string;
    model: string;
    error: string | null;
    createdAt: Date;
  }>;
  hourlyBreakdown: HourlyData[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setRefresh((r) => r + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const maxHourlyReqs = Math.max(...stats.hourlyBreakdown.map((h) => h.requests), 1);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time analytics and monitoring</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
          Auto-refresh 15s
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Requests" value={stats.totalRequests.toLocaleString()} />
        <StatCard label="Total Tokens" value={stats.totalTokens.toLocaleString()} />
        <StatCard label="Avg Latency" value={`${Math.round(stats.averageLatencyMs)}ms`} />
        <StatCard label="P95 Latency" value={`${Math.round(stats.p95LatencyMs)}ms`} />
        <StatCard
          label="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          color={stats.successRate > 95 ? "green" : stats.successRate > 80 ? "yellow" : "red"}
        />
        <StatCard label="Success" value={stats.successCount.toLocaleString()} color="green" />
        <StatCard label="Errors" value={stats.errorCount.toLocaleString()} color="red" />
        <StatCard label="Cancelled" value={stats.cancelledCount.toLocaleString()} color="gray" />
        <StatCard label="Req/min" value={stats.requestsPerMinute.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card variant="brand">
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              Hourly Requests (24h)
            </h2>
          </CardHeader>
          <CardContent>
            {stats.hourlyBreakdown.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No data yet</p>
            ) : (
              <div className="space-y-1">
                {stats.hourlyBreakdown.map((h) => (
                  <div key={h.hour} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-32 shrink-0 font-mono">
                      {new Date(h.hour).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                      })}
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full rounded-full transition-all"
                        style={{ width: `${(h.requests / maxHourlyReqs) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-600 w-16 text-right font-mono">
                      {h.requests}
                    </span>
                    {h.errors > 0 && (
                      <span className="text-xs text-red-500 w-10 text-right font-mono">
                        {h.errors}e
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="brand">
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              Provider Breakdown
            </h2>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.byProvider).length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.byProvider).map(([provider, data]) => {
                  const maxCount = Math.max(
                    ...Object.values(stats.byProvider).map((v) => v.count),
                    1,
                  );
                  return (
                    <div key={provider}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-900 capitalize">
                          {provider}
                        </span>
                        <span className="text-sm text-slate-500">
                          {data.count} req · {data.avgLatencyMs.toFixed(0)}ms avg
                        </span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all"
                          style={{ width: `${(data.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                        <span>{data.totalTokens.toLocaleString()} tokens</span>
                        {data.errors > 0 && (
                          <span className="text-red-400">{data.errors} errors</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {stats.recentErrors.length > 0 && (
        <Card variant="brand">
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Recent Errors
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentErrors.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start gap-3 p-3 bg-red-50/80 rounded-xl border border-red-100"
                >
                  <div className="w-2 h-2 mt-1.5 bg-red-500 rounded-full shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-red-800">
                      {e.provider}/{e.model}
                    </p>
                    <p className="text-sm text-red-600 truncate">{e.error}</p>
                    <p className="text-xs text-red-400 mt-0.5">
                      {new Date(e.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "blue",
}: {
  label: string;
  value: string;
  color?: "blue" | "green" | "red" | "yellow" | "gray";
}) {
  const colorClasses = {
    blue: "border-indigo-100 bg-indigo-50/50",
    green: "border-emerald-200 bg-emerald-50",
    red: "border-red-200 bg-red-50",
    yellow: "border-amber-200 bg-amber-50",
    gray: "border-slate-200 bg-slate-50",
  };

  const textColors = {
    blue: "text-indigo-700",
    green: "text-emerald-700",
    red: "text-red-700",
    yellow: "text-amber-700",
    gray: "text-slate-700",
  };

  return (
    <Card variant="brand" className={colorClasses[color]}>
      <CardContent className="py-3">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold ${textColors[color]} mt-1`}>{value}</p>
      </CardContent>
    </Card>
  );
}

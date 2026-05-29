"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { TooltipProps } from "recharts";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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

const COLORS = ["#4f46e5", "#7c3aed", "#059669", "#d97706", "#2563eb", "#e11d48", "#0891b2"];

function formatHour(hour: string) {
  const d = new Date(hour);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit" });
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

  const providerData = Object.entries(stats.byProvider).map(([name, d]) => ({
    name,
    requests: d.count,
    tokens: d.totalTokens,
    avgLatency: Math.round(d.avgLatencyMs),
    errors: d.errors,
    successRate: d.count > 0 ? Math.round(((d.count - d.errors) / d.count) * 100) : 0,
  }));

  const hourlyData = stats.hourlyBreakdown.map((h) => ({
    ...h,
    label: formatHour(h.hour),
    success: h.requests - h.errors,
  }));

  const totalReqs = stats.totalRequests || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time inference metrics and visualizations
          </p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
          Auto-refresh 15s
        </span>
      </div>

      {/* KPI STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total Requests"
          value={stats.totalRequests.toLocaleString()}
          icon="activity"
        />
        <StatCard label="Total Tokens" value={stats.totalTokens.toLocaleString()} icon="zap" />
        <StatCard
          label="Avg Latency"
          value={`${Math.round(stats.averageLatencyMs)}ms`}
          icon="clock"
        />
        <StatCard label="P95 Latency" value={`${Math.round(stats.p95LatencyMs)}ms`} icon="alert" />
        <StatCard
          label="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          color={stats.successRate > 95 ? "green" : stats.successRate > 80 ? "yellow" : "red"}
          icon="check"
        />
        <StatCard
          label="Req/min"
          value={stats.requestsPerMinute.toLocaleString()}
          icon="trending"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HOURLY REQUESTS AREA CHART */}
        <Card variant="brand">
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              Request Volume (24h)
            </h2>
          </CardHeader>
          <CardContent>
            {hourlyData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reqGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v: number, n: string) => [
                      v.toLocaleString(),
                      n === "requests" ? "Requests" : n === "errors" ? "Errors" : n,
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke="#4f46e5"
                    fill="url(#reqGradient)"
                    strokeWidth={2}
                    name="requests"
                  />
                  <Area
                    type="monotone"
                    dataKey="errors"
                    stroke="#e11d48"
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    name="errors"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* TOKEN USAGE AREA CHART */}
        <Card variant="brand">
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              Token Consumption (24h)
            </h2>
          </CardHeader>
          <CardContent>
            {hourlyData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v: number) => [v.toLocaleString(), "Tokens"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="#7c3aed"
                    fill="url(#tokenGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* PROVIDER COMPARISON BAR CHART */}
        <Card variant="brand">
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Provider Comparison
            </h2>
          </CardHeader>
          <CardContent>
            {providerData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart
                  data={providerData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="requests"
                    fill="#4f46e5"
                    name="Requests"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                  <Line
                    yAxisId="right"
                    dataKey="avgLatency"
                    stroke="#059669"
                    strokeWidth={2}
                    name="Avg Latency (ms)"
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="right"
                    dataKey="successRate"
                    stroke="#d97706"
                    strokeWidth={2}
                    name="Success Rate %"
                    dot={{ r: 3 }}
                    strokeDasharray="4 4"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* PROVIDER DONUT CHART */}
        <Card variant="brand">
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Requests by Provider
            </h2>
          </CardHeader>
          <CardContent>
            {providerData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No data yet</p>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={providerData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="requests"
                      nameKey="name"
                    >
                      {providerData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      formatter={(v: number, n: string) => [v.toLocaleString(), n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {providerData.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-[11px] text-slate-600 font-medium capitalize">
                        {p.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {Math.round((p.requests / totalReqs) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* LATENCY DISTRIBUTION */}
        <Card variant="brand" className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Latency & Errors Over Time
            </h2>
          </CardHeader>
          <CardContent>
            {hourlyData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart
                  data={hourlyData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="requests"
                    fill="#4f46e5"
                    name="Requests"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                  />
                  <Line
                    yAxisId="right"
                    dataKey="avg_latency"
                    stroke="#2563eb"
                    strokeWidth={2}
                    name="Avg Latency (ms)"
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="right"
                    dataKey="errors"
                    stroke="#e11d48"
                    strokeWidth={2}
                    name="Errors"
                    dot={{ r: 3 }}
                    strokeDasharray="4 4"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TOP MODELS TABLE */}
      <Card variant="brand">
        <CardHeader>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Provider Performance Summary
          </h2>
        </CardHeader>
        <CardContent>
          {providerData.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 text-[11px] font-mono-alt text-slate-400 uppercase tracking-wider font-medium">
                      Provider
                    </th>
                    <th className="text-right py-3 px-2 text-[11px] font-mono-alt text-slate-400 uppercase tracking-wider font-medium">
                      Requests
                    </th>
                    <th className="text-right py-3 px-2 text-[11px] font-mono-alt text-slate-400 uppercase tracking-wider font-medium">
                      Tokens
                    </th>
                    <th className="text-right py-3 px-2 text-[11px] font-mono-alt text-slate-400 uppercase tracking-wider font-medium">
                      Avg Latency
                    </th>
                    <th className="text-right py-3 px-2 text-[11px] font-mono-alt text-slate-400 uppercase tracking-wider font-medium">
                      Errors
                    </th>
                    <th className="text-right py-3 px-2 text-[11px] font-mono-alt text-slate-400 uppercase tracking-wider font-medium">
                      Success Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {providerData.map((p, i) => (
                    <tr
                      key={p.name}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="font-medium text-slate-800 capitalize">{p.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-2 text-slate-600 font-mono-alt">
                        {p.requests.toLocaleString()}
                      </td>
                      <td className="text-right py-2.5 px-2 text-slate-600 font-mono-alt">
                        {p.tokens.toLocaleString()}
                      </td>
                      <td className="text-right py-2.5 px-2 text-slate-600 font-mono-alt">
                        {p.avgLatency}ms
                      </td>
                      <td className="text-right py-2.5 px-2">
                        <span
                          className={`font-mono-alt ${p.errors > 0 ? "text-red-600" : "text-slate-400"}`}
                        >
                          {p.errors}
                        </span>
                      </td>
                      <td className="text-right py-2.5 px-2">
                        <span
                          className={`font-mono-alt font-medium ${p.successRate >= 95 ? "text-emerald-600" : p.successRate >= 80 ? "text-amber-600" : "text-red-600"}`}
                        >
                          {p.successRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-medium">
                    <td className="py-3 px-2 text-slate-800">Total</td>
                    <td className="text-right py-3 px-2 text-slate-800 font-mono-alt">
                      {stats.totalRequests.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-2 text-slate-800 font-mono-alt">
                      {stats.totalTokens.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-2 text-slate-800 font-mono-alt">
                      {Math.round(stats.averageLatencyMs)}ms
                    </td>
                    <td className="text-right py-3 px-2">
                      <span
                        className={`font-mono-alt ${stats.errorCount > 0 ? "text-red-600" : "text-slate-400"}`}
                      >
                        {stats.errorCount}
                      </span>
                    </td>
                    <td className="text-right py-3 px-2">
                      <span
                        className={`font-mono-alt font-medium ${stats.successRate >= 95 ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {stats.successRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RECENT ERRORS */}
      {stats.recentErrors.length > 0 && (
        <Card variant="brand">
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Recent Errors
            </h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 text-[11px] font-mono-alt text-slate-400 uppercase tracking-wider font-medium">
                      Time
                    </th>
                    <th className="text-left py-3 px-2 text-[11px] font-mono-alt text-slate-400 uppercase tracking-wider font-medium">
                      Provider
                    </th>
                    <th className="text-left py-3 px-2 text-[11px] font-mono-alt text-slate-400 uppercase tracking-wider font-medium">
                      Model
                    </th>
                    <th className="text-left py-3 px-2 text-[11px] font-mono-alt text-slate-400 uppercase tracking-wider font-medium">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentErrors.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-slate-50 hover:bg-red-50/30 transition-colors"
                    >
                      <td className="py-2.5 px-2 text-slate-500 font-mono-alt text-[12px]">
                        {new Date(e.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="capitalize font-medium text-slate-700">{e.provider}</span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-500 font-mono-alt text-[12px]">
                        {e.model}
                      </td>
                      <td className="py-2.5 px-2 text-red-600 text-[12px] max-w-md truncate">
                        {e.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
  icon,
}: {
  label: string;
  value: string;
  color?: "blue" | "green" | "red" | "yellow" | "gray";
  icon?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "border-indigo-100 bg-indigo-50/50",
    green: "border-emerald-200 bg-emerald-50",
    red: "border-red-200 bg-red-50",
    yellow: "border-amber-200 bg-amber-50",
    gray: "border-slate-200 bg-slate-50",
  };

  const textColors: Record<string, string> = {
    blue: "text-indigo-700",
    green: "text-emerald-700",
    red: "text-red-700",
    yellow: "text-amber-700",
    gray: "text-slate-700",
  };

  const iconPaths: Record<string, string> = {
    activity: "M13 10V3L4 14h7v7l9-11h-7z",
    zap: "M13 10V3L4 14h7v7l9-11h-7z",
    clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    alert:
      "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    trending: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  };

  return (
    <Card className={`${colorClasses[color]} border`}>
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{label}</p>
          {icon && iconPaths[icon] && (
            <svg
              className="w-3.5 h-3.5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[icon]} />
            </svg>
          )}
        </div>
        <p className={`text-xl font-bold ${textColors[color]} mt-1 font-mono-alt`}>{value}</p>
      </CardContent>
    </Card>
  );
}

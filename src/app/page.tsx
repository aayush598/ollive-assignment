"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

/* ── Hooks ── */
function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0: number | null = null;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, start]);
  return count;
}

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setSeen(true);
      },
      { threshold },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, seen };
}

/* ── Sub-components ── */
function KpiStat({
  value,
  suffix = "",
  label,
  prefix = "",
}: {
  value: number;
  suffix?: string;
  label: string;
  prefix?: string;
}) {
  const { ref, seen } = useInView(0.4);
  const n = useCountUp(value, 1600, seen);
  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <span className="font-mono-alt text-4xl font-semibold text-indigo-600 leading-none">
        {prefix}
        {n.toLocaleString()}
        {suffix}
      </span>
      <span className="font-mono-alt text-[11px] text-slate-400 uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

function Tag({
  color,
  children,
}: {
  color: "blue" | "indigo" | "emerald" | "amber" | "rose" | "violet";
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono-alt font-bold border uppercase tracking-wider ${map[color]}`}
    >
      {children}
    </span>
  );
}

/* ── Dashboard mockup: Inference Log Viewer ── */
function DashboardMockup() {
  const [activeRow, setActiveRow] = useState(1);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setActiveRow((r) => (r + 1) % 5), 2400);
    return () => clearInterval(t);
  }, []);

  const logs = [
    {
      model: "GPT-4",
      provider: "OpenAI",
      latency: "1,240ms",
      tokens: "456",
      status: "OK",
      initials: "OA",
      color: "bg-emerald-500",
    },
    {
      model: "Claude-3.5",
      provider: "Anthropic",
      latency: "2,100ms",
      tokens: "892",
      status: "OK",
      initials: "AN",
      color: "bg-indigo-500",
    },
    {
      model: "Gemini Pro",
      provider: "Google",
      latency: "980ms",
      tokens: "234",
      status: "OK",
      initials: "GO",
      color: "bg-blue-500",
    },
    {
      model: "DeepSeek-R1",
      provider: "DeepSeek",
      latency: "3,450ms",
      tokens: "1,024",
      status: "Timeout",
      initials: "DS",
      color: "bg-rose-500",
    },
    {
      model: "Llama-3.1",
      provider: "NVIDIA",
      latency: "1,670ms",
      tokens: "678",
      status: "OK",
      initials: "NV",
      color: "bg-violet-500",
    },
  ];

  const statusStyle: Record<string, string> = {
    OK: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Timeout: "text-rose-700 bg-rose-50 border-rose-200",
    Error: "text-red-700 bg-red-50 border-red-200",
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-[0_32px_80px_rgba(15,23,42,0.14)] bg-white transition-all duration-500 hover:shadow-[0_32px_80px_rgba(79,70,229,0.12)]">
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
          <div className="flex gap-1.5">
            {["bg-rose-400", "bg-amber-400", "bg-emerald-400"].map((c, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${c} hover:scale-110 cursor-pointer transition-all duration-200`}
              />
            ))}
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-1.5 border border-slate-200 text-xs font-mono-alt text-slate-500 shadow-sm">
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              inference.logger.app/dashboard
            </div>
          </div>
        </div>

        <div className="flex">
          <div className="w-48 border-r border-slate-100 bg-slate-50 p-4 shrink-0 hidden sm:block">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
                <svg
                  className="w-3.5 h-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                  />
                </svg>
              </div>
              <span className="text-xs font-bold text-slate-800">Inference Log</span>
            </div>
            {["Dashboard", "Live Logs", "Analytics", "Models", "Conversations", "Settings"].map(
              (item, i) => (
                <div
                  key={item}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-[11px] font-medium cursor-default transition-all duration-200 ${i === 1 ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${i === 1 ? "bg-indigo-500" : "bg-transparent group-hover:bg-slate-300"}`}
                  />
                  {item}
                </div>
              ),
            )}
          </div>

          <div className="flex-1 p-4 bg-white min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {[
                {
                  label: "Total Inferences",
                  val: "12.4K",
                  delta: "+840",
                  up: true,
                  color: "text-indigo-600",
                },
                {
                  label: "Avg Latency",
                  val: "1.2s",
                  delta: "-80ms",
                  up: true,
                  color: "text-emerald-600",
                },
                {
                  label: "Error Rate",
                  val: "2.1%",
                  delta: "+0.3%",
                  up: false,
                  color: "text-rose-600",
                },
                {
                  label: "Tokens Today",
                  val: "284K",
                  delta: "+12%",
                  up: true,
                  color: "text-blue-600",
                },
              ].map((k, i) => (
                <div
                  key={i}
                  className="bg-slate-50 rounded-xl p-3 border border-slate-100 transition-all duration-200 hover:shadow-md hover:border-indigo-100 hover:-translate-y-0.5 cursor-default"
                >
                  <p className="text-[9px] text-slate-400 font-mono-alt mb-1">{k.label}</p>
                  <p className={`text-base font-bold font-mono-alt ${k.color}`}>{k.val}</p>
                  <p
                    className={`text-[9px] font-mono-alt ${k.up ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    {k.delta}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div
                className="grid text-[9px] font-mono-alt font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100 px-3 py-2"
                style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 16px" }}
              >
                <span>Model</span>
                <span>Provider</span>
                <span>Latency</span>
                <span>Tokens</span>
                <span>Status</span>
                <span />
              </div>
              {logs.map((t, i) => (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className={`grid items-center px-3 py-2.5 border-b border-slate-50 transition-all duration-300 cursor-default ${
                    activeRow === i || hoveredRow === i
                      ? "bg-indigo-50/80 shadow-sm"
                      : "bg-white hover:bg-slate-50"
                  }`}
                  style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 16px" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-full ${t.color} flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0 transition-transform duration-200 ${hoveredRow === i ? "scale-110" : ""}`}
                    >
                      {t.initials}
                    </div>
                    <span className="text-[10px] text-slate-700 truncate">{t.model}</span>
                  </div>
                  <span className="text-[9px] font-mono-alt text-slate-500">{t.provider}</span>
                  <span className="text-[9px] font-mono-alt text-slate-600">{t.latency}</span>
                  <span className="text-[9px] font-mono-alt text-slate-600">{t.tokens}</span>
                  <span
                    className={`text-[9px] font-mono-alt font-bold px-1.5 py-0.5 rounded-full border w-fit ${statusStyle[t.status] || "text-slate-500 bg-slate-50 border-slate-200"}`}
                  >
                    {t.status}
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeRow === i ? "bg-indigo-500 animate-pulse" : hoveredRow === i ? "bg-indigo-300" : "bg-transparent"}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -top-5 -right-5 hidden sm:flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-lg shadow-slate-200/80 animate-float-a hover:scale-105 hover:shadow-xl transition-all duration-300 cursor-pointer group">
        <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] font-bold text-white">
          SDK
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
            SDK connected
          </p>
          <p className="text-[9px] text-slate-400 font-mono-alt">Streaming logs in real-time</p>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      <div className="absolute -bottom-5 -left-4 hidden sm:flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-lg shadow-slate-200/80 animate-float-b hover:scale-105 hover:shadow-xl transition-all duration-300 cursor-pointer group">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <p className="text-[10px] font-semibold text-slate-700 group-hover:text-rose-700 transition-colors">
          Alert: <span className="text-rose-600 font-bold">DeepSeek timeout</span>
        </p>
      </div>
    </div>
  );
}

/* ── Ingestion Pipeline Workflow ── */
function WorkflowDiagram() {
  const steps = [
    {
      label: "LLM App Call",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      ),
      color: "bg-indigo-100 border-indigo-300 text-indigo-700",
      dot: "bg-indigo-500",
      mockup: "app",
    },
    {
      label: "SDK Captures Metadata",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
      color: "bg-blue-100 border-blue-300 text-blue-700",
      dot: "bg-blue-500",
      mockup: "sdk",
    },
    {
      label: "Ingestion API",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      ),
      color: "bg-violet-100 border-violet-300 text-violet-700",
      dot: "bg-violet-500",
      mockup: "api",
    },
    {
      label: "Database Storage",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
      color: "bg-emerald-100 border-emerald-300 text-emerald-700",
      dot: "bg-emerald-500",
      mockup: "db",
    },
    {
      label: "Dashboards & Alerts",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
      color: "bg-amber-100 border-amber-300 text-amber-700",
      dot: "bg-amber-500",
      mockup: "dash",
    },
  ];

  const [active, setActive] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % steps.length), 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = (i: number) => {
    if (i !== active) {
      setIsAnimating(true);
      setActive(i);
      setTimeout(() => setIsAnimating(false), 400);
    }
  };

  const mockups: Record<string, React.ReactNode> = {
    app: (
      <div className="bg-white rounded-lg border border-indigo-100 p-3 transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <span className="text-xs font-semibold text-slate-800">Chat App → GPT-4</span>
        </div>
        <p className="text-[9px] text-slate-400">
          User: {"\u201C"}Explain quantum computing{"\u201D"} · 1.2s latency
        </p>
      </div>
    ),
    sdk: (
      <div className="bg-white rounded-lg border border-blue-100 p-3 space-y-2 transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500 flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <span className="text-[10px] font-mono-alt text-slate-600">
            model: {"\u201C"}gpt-4{"\u201D"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500 flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <span className="text-[10px] font-mono-alt text-slate-600">
            tokens: {`{prompt: 145, completion: 311}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500 flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <span className="text-[10px] font-mono-alt text-slate-600">latency_ms: 1240</span>
        </div>
      </div>
    ),
    api: (
      <div className="bg-white rounded-lg border border-violet-100 p-3 transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-800">POST /api/ingest</span>
          <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
            201 Created
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[9px]">
            <span className="text-slate-400">Zod Validation</span>
            <span className="font-bold text-emerald-600">Passed</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full w-full bg-emerald-500 rounded-full" />
          </div>
        </div>
      </div>
    ),
    db: (
      <div className="bg-white rounded-lg border border-emerald-100 p-3 transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center">
            <svg
              className="w-2.5 h-2.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-slate-800">PostgreSQL Inserted</span>
        </div>
        <p className="text-[9px] text-slate-400">inference_logs · 1 row · 0.8ms</p>
      </div>
    ),
    dash: (
      <div className="bg-white rounded-lg border border-amber-100 p-3 transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <svg
            className="w-4 h-4 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span className="text-xs font-semibold text-slate-800">Analytics Updated</span>
        </div>
        <p className="text-[9px] text-slate-400">Latency: 1.2s avg · Throughput: 42 rpm</p>
      </div>
    ),
  };

  return (
    <div>
      <div className="flex flex-col gap-2 mb-4">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className={`flex items-center gap-2 rounded-lg p-2 transition-all duration-300 text-left ${
              active === i
                ? `${s.color} shadow-sm`
                : "border border-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-700"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 ${active === i ? "bg-white/50" : "bg-slate-100"}`}
            >
              <span className={active === i ? "text-current" : "text-slate-400"}>{s.icon}</span>
            </div>
            <span className={`text-xs font-medium flex-1 ${active === i ? "" : "text-slate-500"}`}>
              {s.label}
            </span>
            {active === i && <div className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />}
          </button>
        ))}
      </div>
      <div
        className={`mt-4 pt-4 border-t border-slate-200 transition-all duration-400 ${isAnimating ? "opacity-50 scale-95" : "opacity-100 scale-100"}`}
      >
        {mockups[steps[active].mockup]}
      </div>
    </div>
  );
}

/* ── Inference activity feed ── */
function ActivityFeed() {
  const events = [
    {
      user: "GPT-4",
      action: "completed inference",
      target: "456 tokens · 1.2s",
      time: "just now",
      color: "bg-emerald-500",
      type: "emerald",
    },
    {
      user: "Claude-3.5",
      action: "streaming response",
      target: "892 tokens · 2.1s",
      time: "12s ago",
      color: "bg-indigo-500",
      type: "indigo",
    },
    {
      user: "DeepSeek-R1",
      action: "request timed out",
      target: "30s threshold exceeded",
      time: "45s ago",
      color: "bg-rose-500",
      type: "rose",
    },
    {
      user: "Gemini Pro",
      action: "completed inference",
      target: "234 tokens · 0.9s",
      time: "2m ago",
      color: "bg-blue-500",
      type: "blue",
    },
    {
      user: "Llama-3.1",
      action: "completed inference",
      target: "678 tokens · 1.7s",
      time: "3m ago",
      color: "bg-violet-500",
      type: "violet",
    },
    {
      user: "Mixtral-8x7b",
      action: "error upstream",
      target: "503 provider unavailable",
      time: "5m ago",
      color: "bg-amber-500",
      type: "amber",
    },
  ];
  const [highlighted, setHighlighted] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setHighlighted((p) => (p + 1) % events.length), 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2.5">
      {events.map((e, i) => (
        <div
          key={i}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
          className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 cursor-default ${
            highlighted === i || hoveredIdx === i
              ? "bg-slate-50 border-slate-200 shadow-sm"
              : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100"
          }`}
        >
          <div
            className={`w-7 h-7 rounded-full ${e.color} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-0.5 transition-transform duration-200 ${hoveredIdx === i ? "scale-110" : ""}`}
          >
            {e.user.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-700">
              <span className="font-semibold">{e.user}</span>
              <span className="text-slate-500"> {e.action} </span>
              <span
                className="font-semibold"
                style={{
                  color:
                    e.type === "emerald"
                      ? "#059669"
                      : e.type === "violet"
                        ? "#7c3aed"
                        : e.type === "rose"
                          ? "#e11d48"
                          : e.type === "indigo"
                            ? "#4f46e5"
                            : e.type === "blue"
                              ? "#2563eb"
                              : "#d97706",
                }}
              >
                {e.target}
              </span>
            </p>
            <p className="text-[10px] text-slate-400 font-mono-alt mt-0.5">{e.time}</p>
          </div>
          {(highlighted === i || hoveredIdx === i) && (
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse mt-1.5 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── BentoCard with mouse-tracking ── */
function BentoCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [hovering, setHovering] = useState(false);
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };
  return (
    <div
      className={`relative rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all duration-300 hover:shadow-[0_16px_48px_rgba(79,70,229,0.1)] hover:border-indigo-200 group ${className}`}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {hovering && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(79,70,229,0.05) 0%, transparent 60%)`,
          }}
        />
      )}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      {children}
    </div>
  );
}

/* ── Testimonial ── */
function Testimonial({
  quote,
  name,
  role,
  initials,
  color,
  delay = 0,
}: {
  quote: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  delay?: number;
}) {
  const { ref, seen } = useInView(0.15);
  return (
    <div
      ref={ref}
      className="bg-white rounded-2xl border border-slate-200 p-6 transition-all duration-700 shadow-sm hover:shadow-md hover:border-indigo-100"
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? "translateY(0)" : "translateY(20px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="flex gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            key={i}
            className="w-3.5 h-3.5 text-amber-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      <p className="text-slate-600 text-sm leading-relaxed mb-5">
        {"\u201C"}
        {quote}
        {"\u201D"}
      </p>
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-xs font-bold text-white`}
        >
          {initials}
        </div>
        <div>
          <p className="text-slate-900 text-sm font-semibold">{name}</p>
          <p className="text-slate-400 text-xs font-mono-alt">{role}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Conversation queue drag-drop ── */
function DragDropMockup() {
  const [items, setItems] = useState([
    "Chat: Quantum Physics",
    "Chat: Python Debug",
    "Chat: SQL Query",
    "Chat: Essay Edit",
  ]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dropZone, setDropZone] = useState<number | null>(null);

  const handleDragStart = (i: number) => {
    setDraggedIdx(i);
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDropZone(i);
  };

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === i) return;
    const newItems = [...items];
    const [removed] = newItems.splice(draggedIdx, 1);
    newItems.splice(i, 0, removed);
    setItems(newItems);
    setDraggedIdx(null);
    setDropZone(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDropZone(null);
  };

  const statuses = ["bg-indigo-500", "bg-blue-500", "bg-emerald-500", "bg-violet-500"];
  const initials = ["CP", "PD", "SQ", "EE"];

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-400 font-mono-alt mb-3">
        Drag to reorder active conversations
      </p>
      {items.map((item, i) => (
        <div
          key={item}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={(e) => handleDrop(e, i)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 cursor-grab active:cursor-grabbing ${
            draggedIdx === i
              ? "opacity-50 border-indigo-300 bg-indigo-50 shadow-lg scale-105"
              : dropZone === i
                ? "border-indigo-400 bg-indigo-50/50"
                : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2 text-slate-400">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
            </svg>
          </div>
          <div
            className={`w-6 h-6 rounded-full ${statuses[i]} flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0`}
          >
            {initials[i]}
          </div>
          <span className="text-xs text-slate-700 flex-1">{item}</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-slate-400 font-mono-alt">Active</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const r = heroRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ══════════ NAVBAR ══════════ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "nav-glass" : "bg-transparent"}`}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform duration-300">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
            </div>
            <span className="font-['Bricolage_Grotesque',sans-serif] font-bold text-slate-900 text-sm tracking-tight">
              Inference <span className="text-indigo-600">Logger</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {["Features", "Pipeline", "Pricing", "Team"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm text-slate-500 hover:text-slate-900 px-3.5 py-2 rounded-lg hover:bg-slate-50 transition-all duration-200 font-medium"
              >
                {item}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {!isLoaded ? (
              <div className="h-5 w-20 bg-slate-200 rounded animate-pulse" />
            ) : isSignedIn ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/chat"
                  className="btn-primary text-sm px-5 py-2.5 flex items-center gap-1.5"
                >
                  Dashboard
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
                <UserButton />
              </div>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium px-3 py-1.5">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn-primary text-sm px-5 py-2.5 flex items-center gap-1.5">
                    Get Started
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </button>
                </SignUpButton>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-slate-500 hover:text-slate-900"
          >
            {mobileOpen ? (
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100 px-5 py-4 space-y-1">
            {["Features", "Pipeline", "Pricing", "Team"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-slate-600 hover:text-slate-900 py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-all"
              >
                {item}
              </a>
            ))}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              {isSignedIn ? (
                <Link href="/chat" className="btn-primary text-sm text-center py-3 block">
                  Dashboard
                </Link>
              ) : (
                <>
                  <SignInButton mode="modal">
                    <button className="text-sm text-center text-slate-500 py-2.5 w-full">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="btn-primary text-sm text-center py-3 block w-full">
                      Get Started Free
                    </button>
                  </SignUpButton>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center text-center px-5 pt-24 pb-20 overflow-hidden"
      >
        <div className="absolute inset-0 hero-mesh pointer-events-none" />
        <div className="absolute inset-0 dot-grid pointer-events-none opacity-60" />

        <div
          className="absolute pointer-events-none rounded-full blur-3xl opacity-[0.08] w-80 h-80"
          style={{
            background: "radial-gradient(circle, rgba(79,70,229,1) 0%, transparent 70%)",
            left: mousePos.x - 160,
            top: mousePos.y - 160,
            transition: "left 0.12s ease-out, top 0.12s ease-out",
          }}
        />

        <svg
          className="absolute top-20 right-10 w-64 h-64 opacity-[0.06] pointer-events-none hidden lg:block"
          viewBox="0 0 200 200"
          fill="none"
        >
          <circle cx="100" cy="100" r="80" stroke="#4f46e5" strokeWidth="1" strokeDasharray="6 4" />
          <circle
            cx="100"
            cy="100"
            r="55"
            stroke="#2563eb"
            strokeWidth="0.8"
            strokeDasharray="4 6"
          />
          <circle cx="100" cy="100" r="30" stroke="#7c3aed" strokeWidth="0.6" />
        </svg>
        <svg
          className="absolute bottom-20 left-10 w-48 h-48 opacity-[0.05] pointer-events-none hidden lg:block"
          viewBox="0 0 200 200"
          fill="none"
        >
          <circle
            cx="100"
            cy="100"
            r="70"
            stroke="#4f46e5"
            strokeWidth="1.2"
            strokeDasharray="8 4"
          />
        </svg>

        {/* Floating background mockups */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden hidden lg:block">
          <div className="group absolute top-[12%] left-[6%] animate-float-a cursor-default pointer-events-auto">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-3 shadow-lg shadow-indigo-200/20 transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-xl hover:shadow-indigo-300/30 hover:-translate-y-1 opacity-60 hover:opacity-100">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono-alt text-slate-500 font-semibold">
                  LATENCY
                </span>
              </div>
              <p className="text-sm font-bold text-slate-800 font-mono-alt">
                1,240<span className="text-slate-400 font-normal text-xs">ms</span>
              </p>
              <p className="text-[8px] text-slate-400 mt-0.5">P50 · last 5 min</p>
            </div>
          </div>

          <div
            className="group absolute top-[22%] right-[8%] animate-float-b cursor-default pointer-events-auto"
            style={{ animationDelay: "1s" }}
          >
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-3 shadow-lg shadow-indigo-200/20 transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-xl hover:shadow-indigo-300/30 hover:-translate-y-1 opacity-60 hover:opacity-100">
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"
                  style={{ animationDelay: "0.5s" }}
                />
                <span className="text-[9px] font-mono-alt text-slate-500 font-semibold">
                  TOKENS
                </span>
              </div>
              <p className="text-sm font-bold text-slate-800 font-mono-alt">
                28.4<span className="text-slate-400 font-normal text-xs">K</span>
              </p>
              <p className="text-[8px] text-slate-400 mt-0.5">total today</p>
            </div>
          </div>

          <div
            className="group absolute top-[45%] left-[3%] cursor-default pointer-events-auto"
            style={{ animation: "float-b 6s ease-in-out infinite", animationDelay: "0.5s" }}
          >
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-3 shadow-lg shadow-indigo-200/20 transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-xl hover:shadow-indigo-300/30 hover:-translate-y-1 opacity-50 hover:opacity-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-4 rounded bg-indigo-500/20 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-indigo-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <span className="text-[8px] text-slate-400 font-mono-alt">gpt-4 · streaming</span>
              </div>
              <div className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>

          <div
            className="group absolute top-[55%] right-[4%] cursor-default pointer-events-auto"
            style={{ animation: "float-a 7s ease-in-out infinite", animationDelay: "2s" }}
          >
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-3 shadow-lg shadow-indigo-200/20 transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-xl hover:shadow-indigo-300/30 hover:-translate-y-1 opacity-50 hover:opacity-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[8px] text-slate-400 font-mono-alt">error rate</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-rose-600 font-mono-alt">2.1</span>
                <span className="text-[9px] text-rose-400">%</span>
              </div>
              <div className="h-1 w-full bg-rose-100 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full w-[21%] bg-rose-500 rounded-full" />
              </div>
            </div>
          </div>

          <div
            className="group absolute top-[8%] left-[35%] cursor-default pointer-events-auto"
            style={{ animation: "float-b 8s ease-in-out infinite", animationDelay: "0.2s" }}
          >
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-2.5 shadow-lg shadow-indigo-200/20 transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-xl hover:shadow-indigo-300/30 hover:-translate-y-1 opacity-50 hover:opacity-100">
              <div className="flex gap-1 mb-1">
                {[40, 65, 55, 80, 45].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-t-sm bg-gradient-to-t from-indigo-400 to-indigo-300 transition-all duration-200 hover:from-indigo-500"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <p className="text-[7px] text-slate-400 font-mono-alt">requests</p>
            </div>
          </div>

          <div
            className="group absolute bottom-[22%] left-[12%] cursor-default pointer-events-auto"
            style={{ animation: "float-a 5.5s ease-in-out infinite", animationDelay: "1.5s" }}
          >
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-2.5 shadow-lg shadow-indigo-200/20 transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-xl hover:shadow-indigo-300/30 hover:-translate-y-1 opacity-50 hover:opacity-100">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-slate-900 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <span className="text-[8px] text-slate-400 font-mono-alt">SDK v2.1</span>
              </div>
            </div>
          </div>

          <div
            className="group absolute bottom-[30%] right-[10%] cursor-default pointer-events-auto"
            style={{ animation: "float-b 6.5s ease-in-out infinite", animationDelay: "3s" }}
          >
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-2.5 shadow-lg shadow-indigo-200/20 transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-xl hover:shadow-indigo-300/30 hover:-translate-y-1 opacity-50 hover:opacity-100">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg
                    className="w-2.5 h-2.5 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[8px] text-slate-400 font-mono-alt">200 OK</span>
              </div>
              <p className="text-[7px] text-slate-300 mt-0.5">POST /api/ingest</p>
            </div>
          </div>
        </div>

        <div className="s1 pill-indigo inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-['IBM_Plex_Mono',monospace] font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 uppercase tracking-wider mb-6">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
          </span>
          LLM Observability Platform
        </div>

        <h1 className="s2 font-['Bricolage_Grotesque',sans-serif] text-5xl md:text-7xl lg:text-[80px] text-slate-900 max-w-5xl leading-[1.04] tracking-tight mb-5">
          Log, Monitor & Analyze
          <br />
          <span className="gradient-headline">Every LLM Inference</span>
        </h1>

        <p className="s3 text-slate-500 text-lg md:text-xl max-w-2xl leading-relaxed mb-10">
          Capture every LLM call with a lightweight SDK — model, provider, latency, token usage,
          errors — and visualize everything in beautiful dashboards. Multi-provider,
          streaming-ready, production-hardened.
        </p>

        <div className="s4 flex flex-col sm:flex-row items-center gap-3 mb-12">
          {isSignedIn ? (
            <Link
              href="/chat"
              className="btn-primary px-7 py-3.5 text-sm flex items-center gap-2 group"
            >
              Go to Dashboard
              <svg
                className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          ) : (
            <>
              <SignUpButton mode="modal">
                <button className="btn-primary px-7 py-3.5 text-sm flex items-center gap-2 group">
                  Start Free Today
                  <svg
                    className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="btn-secondary px-7 py-3.5 text-sm flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx={12} cy={12} r={10} />
                    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                  </svg>
                  Sign In
                </button>
              </SignInButton>
            </>
          )}
        </div>

        <div className="s5 flex flex-wrap items-center justify-center gap-5 mb-16">
          {[
            "No credit card required",
            "Multi-provider support",
            "Docker one-command setup",
            "TypeScript SDK",
          ].map((t) => (
            <span
              key={t}
              className="font-['IBM_Plex_Mono',monospace] flex items-center gap-1.5 text-[11px] text-slate-400"
            >
              <svg
                className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t}
            </span>
          ))}
        </div>

        <div className="s6 w-full max-w-4xl mx-auto">
          <DashboardMockup />
        </div>
      </section>

      {/* ══════════ MARQUEE ══════════ */}
      <div className="border-y border-slate-100 py-4 bg-slate-50 overflow-hidden">
        <div className="flex gap-10 animate-marquee whitespace-nowrap" aria-hidden>
          {[
            "GPT-4",
            "Claude Sonnet",
            "Gemini Pro",
            "DeepSeek-R1",
            "Llama-3.1",
            "Next.js 16",
            "TypeScript",
            "Drizzle ORM",
            "PostgreSQL",
            "Clerk Auth",
            "Zustand",
            "React 19",
            "Zod Validation",
            "Docker Compose",
            "Recharts",
            "GPT-4",
            "Claude Sonnet",
            "Gemini Pro",
            "DeepSeek-R1",
            "Llama-3.1",
            "Next.js 16",
            "TypeScript",
            "Drizzle ORM",
            "PostgreSQL",
            "Clerk Auth",
            "Zustand",
            "React 19",
            "Zod Validation",
            "Docker Compose",
            "Recharts",
          ].map((item, i) => (
            <span
              key={i}
              className="font-['IBM_Plex_Mono',monospace] text-xs text-slate-400 flex items-center gap-3"
            >
              <span className="w-1 h-1 rounded-full bg-indigo-300 inline-block" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════ STATS ══════════ */}
      <section className="py-20 px-5 bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
          <KpiStat value={12500} suffix="+" label="Inferences Logged" />
          <KpiStat value={8} suffix="" label="LLM Providers" />
          <KpiStat value={99} suffix="%" label="Ingestion Uptime" />
          <KpiStat value={42} suffix="ms" label="Avg Processing Time" />
        </div>
      </section>

      {/* ══════════ ARCHITECTURE INFOGRAPHIC ══════════ */}
      <section className="py-20 px-5 md:px-8 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="pill-violet inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-['IBM_Plex_Mono',monospace] font-bold border border-violet-200 bg-violet-50 text-violet-700 uppercase tracking-wider mb-4">
              System Architecture
            </span>
            <h2 className="font-['Bricolage_Grotesque',sans-serif] text-3xl md:text-4xl text-slate-900 leading-tight mb-3">
              End-to-end ingestion pipeline
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm">
              Every LLM call flows through a lightweight SDK, validation layer, PII redaction, and
              storage — all within a single Next.js process.
            </p>
          </div>

          {/* Architecture Flow Diagram */}
          <div className="relative bg-slate-900 rounded-2xl p-6 md:p-8 overflow-hidden shadow-xl border border-slate-800">
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            />
            <div className="relative z-10">
              {/* Layer labels */}
              <div className="grid grid-cols-6 gap-2 mb-6">
                {[
                  "APPLICATION",
                  "SDK LAYER",
                  "INGESTION API",
                  "PIPELINE",
                  "STORAGE",
                  "OBSERVABILITY",
                ].map((l, i) => (
                  <div key={i} className="text-center">
                    <span className="font-['IBM_Plex_Mono',monospace] text-[8px] text-slate-500 uppercase tracking-[0.2em]">
                      {l}
                    </span>
                  </div>
                ))}
              </div>

              {/* Flow nodes */}
              <div className="grid grid-cols-6 gap-2 mb-3">
                {[
                  {
                    label: "Your App",
                    icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z",
                    color: "bg-indigo-500",
                  },
                  {
                    label: "SDK Wrapper",
                    icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
                    color: "bg-violet-500",
                  },
                  { label: "/api/ingest", icon: "M5 12h14M12 5l7 7-7 7", color: "bg-blue-500" },
                  {
                    label: "Validate",
                    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
                    color: "bg-emerald-500",
                  },
                  {
                    label: "PostgreSQL",
                    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
                    color: "bg-amber-500",
                  },
                  {
                    label: "Dashboards",
                    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
                    color: "bg-rose-500",
                  },
                ].map((node, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 group">
                    <div
                      className={`w-full aspect-square max-w-[90px] mx-auto ${node.color} rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl`}
                    >
                      <svg
                        className="w-6 h-6 md:w-8 md:h-8 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={node.icon} />
                      </svg>
                    </div>
                    <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-400 text-center leading-tight group-hover:text-white transition-colors">
                      {node.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Flow arrows */}
              <div className="grid grid-cols-6 gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-center">
                    <svg
                      className="w-8 h-4 text-slate-600 animate-pulse"
                      style={{ animationDelay: `${i * 300}ms` }}
                      fill="none"
                      viewBox="0 0 24 8"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M1 4h20m0 0l-4-3m4 3l-4 3"
                      />
                    </svg>
                  </div>
                ))}
                <div />
              </div>

              {/* Pipeline detail row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "SDK Buffers",
                    desc: "In-memory buffer (max 50 logs), auto-flush every 5s or on process exit",
                    color: "border-violet-800 bg-violet-950/40",
                  },
                  {
                    label: "Zod Validation",
                    desc: "Provider, model, status, tokens, latency all validated before insert",
                    color: "border-blue-800 bg-blue-950/40",
                  },
                  {
                    label: "PII Redaction",
                    desc: "Email, phone, SSN, credit card patterns detected and redacted",
                    color: "border-emerald-800 bg-emerald-950/40",
                  },
                ].map((detail, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border ${detail.color} p-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02]`}
                  >
                    <p className="font-['IBM_Plex_Mono',monospace] text-[10px] font-bold text-white mb-1">
                      {detail.label}
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{detail.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              {
                label: "Avg Ingest Time",
                value: "24ms",
                sub: "P95: 48ms",
                color: "border-indigo-200 bg-indigo-50",
              },
              {
                label: "Batch Size",
                value: "50",
                sub: "Max per request",
                color: "border-violet-200 bg-violet-50",
              },
              {
                label: "Throughput",
                value: "1.2K/min",
                sub: "Per instance",
                color: "border-emerald-200 bg-emerald-50",
              },
              {
                label: "Uptime",
                value: "99.97%",
                sub: "Last 30 days",
                color: "border-blue-200 bg-blue-50",
              },
            ].map((m, i) => (
              <div
                key={i}
                className={`rounded-xl border ${m.color} p-4 text-center transition-all duration-200 hover:shadow-md`}
              >
                <p className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                  {m.label}
                </p>
                <p className="font-['Bricolage_Grotesque',sans-serif] text-2xl font-bold text-slate-900">
                  {m.value}
                </p>
                <p className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-400 mt-0.5">
                  {m.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ PROVIDER COMPARISON TABLE ══════════ */}
      <section className="py-20 px-5 md:px-8 bg-slate-50 border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="pill-blue inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-['IBM_Plex_Mono',monospace] font-bold border border-blue-200 bg-blue-50 text-blue-700 uppercase tracking-wider mb-4">
              Provider Comparison
            </span>
            <h2 className="font-['Bricolage_Grotesque',sans-serif] text-3xl md:text-4xl text-slate-900 leading-tight mb-3">
              Six LLM providers, one SDK
            </h2>
            <p className="text-slate-500 text-sm max-w-xl mx-auto">
              Switch between providers with a single config change. Each provider implements a
              unified{" "}
              <code className="font-['IBM_Plex_Mono',monospace] text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                generate()
              </code>{" "}
              and{" "}
              <code className="font-['IBM_Plex_Mono',monospace] text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                generateStream()
              </code>{" "}
              interface.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="text-left py-3.5 px-4 font-['IBM_Plex_Mono',monospace] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Provider
                  </th>
                  <th className="text-left py-3.5 px-4 font-['IBM_Plex_Mono',monospace] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Models
                  </th>
                  <th className="text-center py-3.5 px-4 font-['IBM_Plex_Mono',monospace] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Streaming
                  </th>
                  <th className="text-center py-3.5 px-4 font-['IBM_Plex_Mono',monospace] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Context Window
                  </th>
                  <th className="text-center py-3.5 px-4 font-['IBM_Plex_Mono',monospace] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Rate Limit
                  </th>
                  <th className="text-center py-3.5 px-4 font-['IBM_Plex_Mono',monospace] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Auth
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {[
                  {
                    name: "OpenAI",
                    models: "GPT-4.1, GPT-4.1-mini, GPT-4.1-nano",
                    streaming: true,
                    context: "128K",
                    rate: "10K RPM",
                    auth: "API Key",
                    color: "bg-emerald-100 text-emerald-700",
                  },
                  {
                    name: "Anthropic",
                    models: "Claude Sonnet 4",
                    streaming: true,
                    context: "200K",
                    rate: "4K RPM",
                    auth: "API Key",
                    color: "bg-indigo-100 text-indigo-700",
                  },
                  {
                    name: "Gemini",
                    models: "Gemini 2.5 Flash, 2.5 Pro",
                    streaming: true,
                    context: "1M",
                    rate: "2K RPM",
                    auth: "API Key",
                    color: "bg-blue-100 text-blue-700",
                  },
                  {
                    name: "DeepSeek",
                    models: "DeepSeek Chat, Reasoner",
                    streaming: true,
                    context: "128K",
                    rate: "500 RPM",
                    auth: "API Key",
                    color: "bg-violet-100 text-violet-700",
                  },
                  {
                    name: "OpenRouter",
                    models: "10+ models (unified)",
                    streaming: true,
                    context: "Varies",
                    rate: "200 RPM",
                    auth: "API Key",
                    color: "bg-amber-100 text-amber-700",
                  },
                  {
                    name: "NVIDIA",
                    models: "Llama 3.1, Mistral, Mixtral",
                    streaming: true,
                    context: "128K",
                    rate: "1K RPM",
                    auth: "API Key",
                    color: "bg-rose-100 text-rose-700",
                  },
                ].map((p, i) => (
                  <tr
                    key={p.name}
                    className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${i === 0 ? "" : ""}`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${p.color.split(" ")[0].replace("bg-", "bg-")}`}
                        />
                        <span className="font-semibold text-slate-800">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 font-['IBM_Plex_Mono',monospace] text-[12px]">
                      {p.models}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-['IBM_Plex_Mono',monospace] text-[11px]">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Yes
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center font-['IBM_Plex_Mono',monospace] text-[12px] text-slate-600">
                      {p.context}
                    </td>
                    <td className="py-4 px-4 text-center font-['IBM_Plex_Mono',monospace] text-[12px] text-slate-600">
                      {p.rate}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-['IBM_Plex_Mono',monospace] font-bold ${p.color}`}
                      >
                        {p.auth}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[
              {
                label: "Total Models Supported",
                value: "18+",
                desc: "Across all providers",
                icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
              },
              {
                label: "Lines of Code per Provider",
                value: "~50",
                desc: "Implement generate() + generateStream()",
                icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
              },
              {
                label: "Default Model",
                value: "Llama 3.1 70B",
                desc: "Free tier via NVIDIA API",
                icon: "M13 10V3L4 14h7v7l9-11h-7z",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-5 flex items-start gap-4 transition-all duration-200 hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-indigo-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                  </svg>
                </div>
                <div>
                  <p className="font-['Bricolage_Grotesque',sans-serif] text-xl font-bold text-slate-900">
                    {s.value}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">{s.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ ROADMAP TIMELINE ══════════ */}
      <section className="py-20 px-5 md:px-8 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="pill-amber inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-['IBM_Plex_Mono',monospace] font-bold border border-amber-200 bg-amber-50 text-amber-700 uppercase tracking-wider mb-4">
              Development Roadmap
            </span>
            <h2 className="font-['Bricolage_Grotesque',sans-serif] text-3xl md:text-4xl text-slate-900 leading-tight mb-3">
              What we built and what&apos;s next
            </h2>
            <p className="text-slate-500 text-sm max-w-xl mx-auto">
              From initial prototype to production-ready platform — the evolution of the inference
              logging system.
            </p>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-200 via-violet-200 to-emerald-200 md:-translate-x-px" />

            {[
              {
                phase: "Phase 1",
                title: "Core Chat + SDK",
                date: "Week 1",
                items: [
                  "Next.js 16 app with App Router setup",
                  "Multi-provider LLM registry (OpenAI, Anthropic, etc.)",
                  "Lightweight Ingestion SDK with buffer + flush",
                  "Basic chat UI with streaming support",
                  "PostgreSQL schema with Drizzle ORM",
                ],
                side: "left",
                color: "border-indigo-400 bg-indigo-50",
                dot: "bg-indigo-500",
              },
              {
                phase: "Phase 2",
                title: "Ingestion Pipeline",
                date: "Week 2",
                items: [
                  "/api/ingest batch endpoint with Zod validation",
                  "PII redaction engine (email, phone, SSN, credit card)",
                  "Conversation CRUD API + cancel/resume lifecycle",
                  "Admin dashboard with aggregate stats",
                  "Rate limiting and auth middleware",
                ],
                side: "right",
                color: "border-violet-400 bg-violet-50",
                dot: "bg-violet-500",
              },
              {
                phase: "Phase 3",
                title: "Observability & DX",
                date: "Week 3",
                items: [
                  "Prometheus metrics + Grafana dashboards",
                  "Pino structured logging (Loki + Promtail)",
                  "BullMQ background job queue with Redis",
                  "Event-driven architecture (Postgres NOTIFY + Redis pub/sub)",
                  "Docker Compose profiles (dev, prod, observability)",
                ],
                side: "left",
                color: "border-emerald-400 bg-emerald-50",
                dot: "bg-emerald-500",
              },
              {
                phase: "Phase 4",
                title: "Production Hardening",
                date: "Week 4",
                items: [
                  "Clerk auth migration (from Better Auth)",
                  "119 unit/integration tests across 14 files",
                  "Kubernetes manifests (Kustomize) with HPA",
                  "Caddy reverse proxy with auto TLS",
                  "Recharts analytics dashboard (area, bar, pie charts)",
                ],
                side: "right",
                color: "border-blue-400 bg-blue-50",
                dot: "bg-blue-500",
              },
            ].map((phase, i) => (
              <div
                key={i}
                className={`relative flex flex-col md:flex-row items-start gap-6 mb-10 pl-14 md:pl-0 ${
                  phase.side === "right" ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* Dot */}
                <div
                  className={`absolute left-4 md:left-1/2 top-1 w-4 h-4 rounded-full ${phase.dot} border-4 border-white shadow-sm md:-translate-x-2 z-10`}
                />

                {/* Content */}
                <div className={`md:w-1/2 ${phase.side === "right" ? "md:pl-10" : "md:pr-10"}`}>
                  <div
                    className={`rounded-xl border-2 ${phase.color} p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-['IBM_Plex_Mono',monospace] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {phase.phase}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-500">
                        {phase.date}
                      </span>
                    </div>
                    <h3 className="font-['Bricolage_Grotesque',sans-serif] font-bold text-slate-900 text-base mb-3">
                      {phase.title}
                    </h3>
                    <ul className="space-y-1.5">
                      {phase.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                          <svg
                            className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats row under roadmap */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 pt-10 border-t border-slate-100">
            {[
              { label: "Total Commits", value: "180+", sub: "Across all branches" },
              { label: "Test Coverage", value: "119", sub: "14 test files, 100% pass" },
              { label: "Docker Images", value: "4", sub: "dev, prod, observability, K8s" },
              { label: "API Routes", value: "17", sub: "6 resource types" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="font-['Bricolage_Grotesque',sans-serif] text-3xl font-bold text-indigo-600">
                  {s.value}
                </p>
                <p className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-500 uppercase tracking-wider mt-1">
                  {s.label}
                </p>
                <p className="font-['IBM_Plex_Mono',monospace] text-[9px] text-slate-400">
                  {s.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES BENTO ══════════ */}
      <section id="features" className="py-24 px-5 md:px-8 bg-slate-50 line-grid">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="pill-indigo inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-['IBM_Plex_Mono',monospace] font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 uppercase tracking-wider mb-5">
              Everything Included
            </span>
            <h2 className="font-['Bricolage_Grotesque',sans-serif] text-4xl md:text-5xl text-slate-900 leading-tight mb-4">
              Inference logging that
              <br />
              <span className="gradient-headline">engineers actually want</span>
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-base leading-relaxed">
              From a lightweight SDK that captures every LLM call to real-time dashboards for
              latency, tokens, and errors — built for production AI applications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <BentoCard className="p-7 h-full">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-indigo-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                      />
                    </svg>
                  </div>
                  <div>
                    <Tag color="indigo">6+ Providers</Tag>
                    <h3 className="font-['Bricolage_Grotesque',sans-serif] font-bold text-slate-900 text-lg mt-2">
                      Multi-Provider SDK
                    </h3>
                    <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                      A single lightweight wrapper that works with GPT-4, Claude, Gemini, DeepSeek,
                      Grok, Llama, and any OpenAI-compatible API. Swap providers with one line of
                      config.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: "OpenAI", models: "GPT-4, GPT-4o, o1", color: "bg-emerald-600" },
                    { name: "Anthropic", models: "Claude Sonnet, Opus", color: "bg-indigo-500" },
                    { name: "Google", models: "Gemini Pro, Ultra", color: "bg-blue-500" },
                    { name: "NVIDIA", models: "Llama-3.1, Mistral", color: "bg-violet-500" },
                  ].map((p) => (
                    <div
                      key={p.name}
                      className="bg-slate-50 rounded-xl p-4 border border-slate-100 transition-all duration-200 hover:shadow-sm hover:border-indigo-100"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${p.color}`} />
                        <span className="font-['IBM_Plex_Mono',monospace] text-xs font-bold text-slate-700">
                          {p.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{p.models}</p>
                    </div>
                  ))}
                </div>
              </BentoCard>
            </div>

            <BentoCard className="p-7">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-violet-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div>
                  <Tag color="violet">Real-Time</Tag>
                  <h3 className="font-['Bricolage_Grotesque',sans-serif] font-bold text-slate-900 text-base mt-2">
                    Streaming Support
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    Capture streaming LLM responses token-by-token. Full SSE support with latency
                    tracking per chunk.
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-2.5">
                {[
                  { label: "Chunks Captured", score: "1,284", color: "bg-indigo-500", w: "100%" },
                  { label: "Avg Chunk Latency", score: "24ms", color: "bg-blue-500", w: "84%" },
                  {
                    label: "Stream Success Rate",
                    score: "97.2%",
                    color: "bg-emerald-500",
                    w: "97%",
                  },
                  { label: "P95 Streaming", score: "48ms", color: "bg-amber-500", w: "62%" },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between mb-1">
                      <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-500">
                        {m.label}
                      </span>
                      <span className="font-['IBM_Plex_Mono',monospace] text-[10px] font-bold text-slate-700">
                        {m.score}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${m.color} transition-all duration-1000`}
                        style={{ width: m.w }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>

            <BentoCard className="p-7 lg:row-span-1">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <div>
                  <Tag color="emerald">Live Feed</Tag>
                  <h3 className="font-['Bricolage_Grotesque',sans-serif] font-bold text-slate-900 text-base mt-2">
                    Inference Stream
                  </h3>
                  <p className="text-slate-500 text-xs mt-1">
                    Real-time activity feed of every inference across all providers. Filter by
                    model, status, or time range.
                  </p>
                </div>
              </div>
              <ActivityFeed />
            </BentoCard>

            <BentoCard className="p-7">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                </div>
                <div>
                  <Tag color="amber">Structured Data</Tag>
                  <h3 className="font-['Bricolage_Grotesque',sans-serif] font-bold text-slate-900 text-base mt-2">
                    Metadata Extraction
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    Every inference carries structured metadata: model, provider, latency, token
                    counts, timestamps, status, session ID, and input/output previews.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  ["Provider", "OpenAI", "bg-indigo-100 text-indigo-700"],
                  ["Model", "gpt-4", "bg-blue-100 text-blue-700"],
                  ["Latency", "1,240ms", "bg-emerald-100 text-emerald-700"],
                  ["Tokens", "456 (145+311)", "bg-violet-100 text-violet-700"],
                  ["Session", "conv_abc123", "bg-slate-100 text-slate-700"],
                ].map(([k, v, c]) => (
                  <div
                    key={k as string}
                    className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
                  >
                    <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-slate-500">
                      {k as string}
                    </span>
                    <span
                      className={`font-['IBM_Plex_Mono',monospace] text-[10px] font-bold px-2 py-0.5 rounded-full ${c as string}`}
                    >
                      {v as string}
                    </span>
                  </div>
                ))}
              </div>
            </BentoCard>

            <div className="lg:col-span-2">
              <BentoCard className="p-7 h-full">
                <div className="flex items-start gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <Tag color="blue">Recharts · Analytics</Tag>
                    <h3 className="font-['Bricolage_Grotesque',sans-serif] font-bold text-slate-900 text-base mt-2">
                      Latency, Throughput & Error Dashboards
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">
                      Real-time charts for request latency (P50/P95/P99), throughput RPM, error
                      rates by provider, and token consumption trends.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Avg Latency", val: "1.2s", color: "indigo" },
                    { label: "Error Rate", val: "2.1%", color: "rose" },
                    { label: "Tokens/min", val: "12.4K", color: "emerald" },
                  ].map((k, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 transition-all duration-200 hover:shadow-sm ${
                        k.color === "rose"
                          ? "bg-rose-50 border-rose-100"
                          : k.color === "emerald"
                            ? "bg-emerald-50 border-emerald-100"
                            : "bg-indigo-50 border-indigo-100"
                      }`}
                    >
                      <p className="font-['IBM_Plex_Mono',monospace] text-[9px] text-slate-500 mb-0.5">
                        {k.label}
                      </p>
                      <p
                        className={`font-['IBM_Plex_Mono',monospace] text-xl font-bold ${
                          k.color === "rose"
                            ? "text-rose-700"
                            : k.color === "emerald"
                              ? "text-emerald-700"
                              : "text-indigo-700"
                        }`}
                      >
                        {k.val}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                  <p className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-400 mb-3">
                    Hourly Inference Volume
                  </p>
                  <div className="flex items-end gap-2 h-20">
                    {[
                      { h: 40, label: "00:00", color: "bg-indigo-300" },
                      { h: 65, label: "04:00", color: "bg-indigo-400" },
                      { h: 50, label: "08:00", color: "bg-indigo-300" },
                      { h: 85, label: "12:00", color: "bg-indigo-500" },
                      { h: 72, label: "16:00", color: "bg-indigo-400" },
                      { h: 55, label: "20:00", color: "bg-indigo-300" },
                      { h: 30, label: "Now", color: "bg-emerald-400" },
                    ].map((b, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t-md ${b.color} transition-all duration-700 hover:opacity-80`}
                          style={{ height: `${b.h}%` }}
                        />
                        <span className="font-['IBM_Plex_Mono',monospace] text-[8px] text-slate-400">
                          {b.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </BentoCard>
            </div>

            <BentoCard className="p-7">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-rose-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <div>
                  <Tag color="rose">Zod Validated</Tag>
                  <h3 className="font-['Bricolage_Grotesque',sans-serif] font-bold text-slate-900 text-base mt-2">
                    Ingestion Pipeline
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    Payloads validated at the edge with Zod schemas. Near real-time ingestion with
                    structured storage in PostgreSQL.
                  </p>
                </div>
              </div>
              <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs overflow-hidden transition-all duration-200 hover:shadow-lg">
                <p className="text-slate-500 mb-2">{"// Ingestion schema (Zod)"}</p>
                <p>
                  <span className="text-violet-400">const</span>{" "}
                  <span className="text-blue-300">inferenceSchema</span> ={" "}
                  <span className="text-yellow-300">z</span>.
                  <span className="text-emerald-400">object</span>
                  {"({"}
                </p>
                <p className="pl-3">
                  <span className="text-slate-300">model:</span>{" "}
                  <span className="text-yellow-300">z</span>.
                  <span className="text-emerald-400">string</span>(),
                </p>
                <p className="pl-3">
                  <span className="text-slate-300">provider:</span>{" "}
                  <span className="text-yellow-300">z</span>.
                  <span className="text-emerald-400">enum</span>([
                  <span className="text-green-300">
                    {"\u201C"}openai{"\u201D"}
                  </span>
                  ,{" "}
                  <span className="text-green-300">
                    {"\u201C"}anthropic{"\u201D"}
                  </span>
                  ]),
                </p>
                <p className="pl-3">
                  <span className="text-slate-300">tokens:</span>{" "}
                  <span className="text-yellow-300">z</span>.
                  <span className="text-emerald-400">object</span>({"{"}
                </p>
                <p className="pl-6">
                  <span className="text-slate-300">prompt:</span>{" "}
                  <span className="text-yellow-300">z</span>.
                  <span className="text-emerald-400">number</span>(),{" "}
                  <span className="text-slate-300">completion:</span>{" "}
                  <span className="text-yellow-300">z</span>.
                  <span className="text-emerald-400">number</span>(),
                </p>
                <p className="pl-3">{"}"}),</p>
                <p className="pl-3">
                  <span className="text-slate-300">latency_ms:</span>{" "}
                  <span className="text-yellow-300">z</span>.
                  <span className="text-emerald-400">number</span>(),
                </p>
                <p className="pl-3">
                  <span className="text-slate-300">status:</span>{" "}
                  <span className="text-yellow-300">z</span>.
                  <span className="text-emerald-400">enum</span>([
                  <span className="text-green-300">
                    {"\u201C"}ok{"\u201D"}
                  </span>
                  ,{" "}
                  <span className="text-green-300">
                    {"\u201C"}error{"\u201D"}
                  </span>
                  ,{" "}
                  <span className="text-green-300">
                    {"\u201C"}timeout{"\u201D"}
                  </span>
                  ]),
                </p>
                <p>{"})"};</p>
              </div>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ══════════ PIPELINE + CONVERSATIONS ══════════ */}
      <section id="pipeline" className="py-24 px-5 md:px-8 bg-white">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <span className="pill-violet inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-['IBM_Plex_Mono',monospace] font-bold border border-violet-200 bg-violet-50 text-violet-700 uppercase tracking-wider mb-5">
              Ingestion Pipeline
            </span>
            <h2 className="font-['Bricolage_Grotesque',sans-serif] text-4xl md:text-5xl text-slate-900 leading-tight mb-5">
              From LLM call to
              <br />
              <span className="gradient-headline">stored insight</span>
            </h2>
            <p className="text-slate-500 leading-relaxed mb-8 text-base">
              End-to-end ingestion flow: your LLM application calls the model, the lightweight SDK
              captures every metadata field, the ingestion API validates and stores it, and
              dashboards visualize everything in real-time.
            </p>
            <div className="space-y-3">
              {[
                {
                  label: "Lightweight SDK",
                  desc: "Drop-in wrapper captures latency, tokens, errors, and session context",
                  color: "text-indigo-600",
                },
                {
                  label: "Near Real-Time Ingestion",
                  desc: "SDK sends structured payloads to /api/ingest via background queue",
                  color: "text-violet-600",
                },
                {
                  label: "Zod Validation",
                  desc: "Every payload validated and typed before hitting the database",
                  color: "text-emerald-600",
                },
                {
                  label: "PostgreSQL Storage",
                  desc: "Messages, inference logs, and metadata stored with sensible schema",
                  color: "text-amber-600",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all duration-300 group cursor-pointer border border-transparent hover:border-indigo-100"
                >
                  <div
                    className={`w-8 h-8 rounded-lg bg-${item.color.includes("indigo") ? "indigo" : item.color.includes("violet") ? "violet" : item.color.includes("emerald") ? "emerald" : "amber"}-50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-all duration-300`}
                  >
                    <svg
                      className="w-4 h-4"
                      style={{ color: item.color.replace("text-", "") }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      {i === 0 ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      ) : i === 1 ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      ) : i === 2 ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      )}
                    </svg>
                  </div>
                  <div>
                    <p className="font-['Bricolage_Grotesque',sans-serif] font-semibold text-slate-900 text-sm mb-0.5 group-hover:text-indigo-600 transition-colors">
                      {item.label}
                    </p>
                    <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 shadow-sm">
              <p className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-400 uppercase tracking-widest mb-5">
                Live Pipeline State
              </p>
              <WorkflowDiagram />
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 shadow-sm">
              <p className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-400 uppercase tracking-widest mb-5">
                Conversation Queue
              </p>
              <DragDropMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ TECH STACK ══════════ */}
      <section className="py-20 px-5 md:px-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="pill-emerald inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-['IBM_Plex_Mono',monospace] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 uppercase tracking-wider mb-4">
              Production Grade
            </span>
            <h2 className="font-['Bricolage_Grotesque',sans-serif] text-3xl md:text-4xl text-slate-900 leading-tight">
              Full-stack inference observability
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                name: "Next.js 16",
                desc: "App Router · Turbopack",
                tag: "Framework",
                color: "border-slate-300 bg-white",
              },
              {
                name: "TypeScript",
                desc: "End-to-end type safety",
                tag: "Language",
                color: "border-blue-200 bg-blue-50",
              },
              {
                name: "Drizzle ORM",
                desc: "SQL-first · Relational",
                tag: "Database",
                color: "border-indigo-200 bg-indigo-50",
              },
              {
                name: "PostgreSQL",
                desc: "Railway · Neon",
                tag: "Storage",
                color: "border-violet-200 bg-violet-50",
              },
              {
                name: "Docker Compose",
                desc: "One-command setup",
                tag: "Infra",
                color: "border-sky-200 bg-sky-50",
              },
              {
                name: "Zustand",
                desc: "Scalable client state",
                tag: "State",
                color: "border-amber-200 bg-amber-50",
              },
              {
                name: "Zod",
                desc: "Validation everywhere",
                tag: "Validation",
                color: "border-rose-200 bg-rose-50",
              },
              {
                name: "Recharts",
                desc: "Real-time analytics",
                tag: "Charts",
                color: "border-emerald-200 bg-emerald-50",
              },
            ].map((tech, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${tech.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default`}
              >
                <p className="font-['IBM_Plex_Mono',monospace] text-[9px] text-slate-400 uppercase tracking-widest mb-1">
                  {tech.tag}
                </p>
                <p className="font-['Bricolage_Grotesque',sans-serif] font-bold text-slate-900 text-sm mb-0.5">
                  {tech.name}
                </p>
                <p className="text-slate-400 text-[11px]">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section id="team" className="py-24 px-5 md:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="pill-blue inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-['IBM_Plex_Mono',monospace] font-bold border border-blue-200 bg-blue-50 text-blue-700 uppercase tracking-wider mb-5">
              Testimonials
            </span>
            <h2 className="font-['Bricolage_Grotesque',sans-serif] text-4xl md:text-5xl text-slate-900 leading-tight">
              Trusted by engineering teams
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <Testimonial
              quote="We dropped in the SDK in 15 minutes. Now we have full visibility into every GPT-4 call — latency, tokens, errors. Finally we can debug AI issues with data instead of guesses."
              name="Anika Sharma"
              role="ML Engineer · Bangalore"
              initials="AS"
              color="bg-indigo-500"
              delay={0}
            />
            <Testimonial
              quote="Multi-provider support is a game-changer. We can compare GPT-4 vs Claude latency side by side in the same dashboard. The ingestion pipeline just works."
              name="Ravi Menon"
              role="Backend Lead · Mumbai"
              initials="RM"
              color="bg-violet-500"
              delay={100}
            />
            <Testimonial
              quote="The real-time dashboard caught a production issue within seconds of deploy. P95 latency spiked, we rolled back immediately. This tool is now critical to our on-call rotation."
              name="Preethi Nair"
              role="SRE · Hyderabad"
              initials="PN"
              color="bg-emerald-500"
              delay={200}
            />
          </div>
        </div>
      </section>

      {/* ══════════ PRICING ══════════ */}
      <section id="pricing" className="py-24 px-5 md:px-8 bg-slate-50 line-grid">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="pill-indigo inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-['IBM_Plex_Mono',monospace] font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 uppercase tracking-wider mb-5">
              Simple Pricing
            </span>
            <h2 className="font-['Bricolage_Grotesque',sans-serif] text-4xl md:text-5xl text-slate-900 leading-tight mb-3">
              Start free, scale with your inference volume
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                plan: "Starter",
                price: "Free",
                period: "",
                highlight: false,
                features: [
                  "10K inferences/month",
                  "3 LLM providers",
                  "7-day log retention",
                  "Basic dashboard",
                  "Community support",
                ],
              },
              {
                plan: "Pro",
                price: "₹2,999",
                period: "/month",
                highlight: true,
                features: [
                  "100K inferences/month",
                  "All providers",
                  "90-day retention",
                  "Streaming support",
                  "Advanced dashboards",
                  "Alerting & webhooks",
                  "Priority support",
                ],
              },
              {
                plan: "Enterprise",
                price: "Custom",
                period: "",
                highlight: false,
                features: [
                  "Unlimited inferences",
                  "Custom providers",
                  "Unlimited retention",
                  "SSO & SCIM",
                  "SLA guarantee",
                  "Dedicated CSM",
                  "On-premise option",
                ],
              },
            ].map((p) => (
              <div
                key={p.plan}
                className={`relative rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 ${
                  p.highlight
                    ? "bg-gradient-to-b from-indigo-50 to-white border-indigo-300 shadow-[0_8px_40px_rgba(79,70,229,0.12)]"
                    : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-lg"
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white font-['IBM_Plex_Mono',monospace] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="mb-5">
                  <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-slate-400 uppercase tracking-widest mb-2">
                    {p.plan}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-['Bricolage_Grotesque',sans-serif] text-4xl font-bold text-slate-900">
                      {p.price}
                    </span>
                    {p.period && (
                      <span className="font-['IBM_Plex_Mono',monospace] text-sm text-slate-400">
                        {p.period}
                      </span>
                    )}
                  </div>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <svg
                        className={`w-4 h-4 flex-shrink-0 ${p.highlight ? "text-indigo-500" : "text-emerald-500"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${p.highlight ? "btn-primary" : "btn-secondary"}`}
                >
                  {p.plan === "Enterprise" ? "Contact Sales" : "Get Started"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="py-24 px-5 md:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div
            className="relative rounded-3xl border border-indigo-100 overflow-hidden noise"
            style={{ background: "linear-gradient(135deg, #eef2ff 0%, #f8f9ff 40%, #eff6ff 100%)" }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% -10%, rgba(79,70,229,0.12) 0%, transparent 70%)",
              }}
            />
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-indigo-100/60 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-blue-100/60 blur-3xl pointer-events-none" />
            <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />

            <div className="relative z-10 text-center p-12 md:p-16">
              <div className="pill-indigo inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-['IBM_Plex_Mono',monospace] font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 uppercase tracking-wider mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Production-Ready Platform
              </div>
              <h2 className="font-['Bricolage_Grotesque',sans-serif] text-4xl md:text-5xl text-slate-900 leading-tight mb-5">
                Ready to log your LLM inferences?
              </h2>
              <p className="text-slate-500 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                A lightweight inference logging and ingestion system with multi-provider SDK
                support, streaming responses, real-time dashboards, and Docker one-command setup.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {isSignedIn ? (
                  <Link
                    href="/chat"
                    className="btn-primary px-8 py-3.5 text-sm flex items-center gap-2 group"
                  >
                    Go to Dashboard
                    <svg
                      className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </Link>
                ) : (
                  <SignUpButton mode="modal">
                    <button className="btn-primary px-8 py-3.5 text-sm flex items-center gap-2 group">
                      Get Started Free
                      <svg
                        className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </button>
                  </SignUpButton>
                )}
                <a
                  href="https://github.com/aayush598/ollive-assignment"
                  className="btn-secondary px-7 py-3.5 text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  View on GitHub
                </a>
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-2">
                {[
                  "Next.js 16",
                  "TypeScript",
                  "Drizzle ORM",
                  "Clerk Auth",
                  "Zustand",
                  "Zod",
                  "PostgreSQL",
                  "Docker",
                ].map((t) => (
                  <span
                    key={t}
                    className="pill-indigo inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-['IBM_Plex_Mono',monospace] font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 uppercase tracking-wider"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="border-t border-slate-100 pt-16 pb-8 px-5 md:px-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                    />
                  </svg>
                </div>
                <span className="font-['Bricolage_Grotesque',sans-serif] font-bold text-slate-900">
                  Inference <span className="text-indigo-600">Logger</span>
                </span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-5">
                A lightweight inference logging and ingestion system for LLM applications. Capture,
                monitor, and analyze every model call.
              </p>
              <div className="flex gap-2.5">
                {[
                  "M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z",
                  "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22",
                  "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z",
                ].map((d, i) => {
                  const urls = [
                    "https://x.com/ollive_ai",
                    "https://github.com/aayush598/ollive-assignment",
                    "https://www.linkedin.com/company/ollive-ai/",
                  ];
                  return (
                    <a
                      key={i}
                      href={urls[i]}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
                      </svg>
                    </a>
                  );
                })}
              </div>
            </div>
            {[
              { title: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
              { title: "Docs", links: ["SDK Setup", "API Reference", "Schema", "Docker Deploy"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-['IBM_Plex_Mono',monospace] text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-4">
                  {col.title}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-slate-400 hover:text-slate-700 text-sm transition-colors"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 pt-7 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-slate-400">
              © 2026 Inference Logger. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-400">
                  All systems operational
                </span>
              </div>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-300">·</span>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-slate-400">
                Built with Next.js 16 · Deployed on Railway
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from "prom-client";

const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [10, 50, 100, 200, 500, 1000, 3000, 5000],
  registers: [registry],
});

export const httpRequestTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [registry],
});

export const httpRequestsInFlight = new Gauge({
  name: "http_requests_in_flight",
  help: "Number of HTTP requests currently in flight",
  labelNames: ["method", "route"] as const,
  registers: [registry],
});

export const httpRequestErrors = new Counter({
  name: "http_request_errors_total",
  help: "Total number of HTTP request errors",
  labelNames: ["method", "route", "error_type"] as const,
  registers: [registry],
});

export const llmInferenceTotal = new Counter({
  name: "llm_inferences_total",
  help: "Total number of LLM inferences",
  labelNames: ["provider", "model", "status"] as const,
  registers: [registry],
});

export const llmInferenceTokens = new Histogram({
  name: "llm_inference_tokens",
  help: "Number of tokens used per inference",
  labelNames: ["provider", "model"] as const,
  buckets: [100, 500, 1000, 2000, 4000, 8000, 16000],
  registers: [registry],
});

export const llmInferenceLatency = new Histogram({
  name: "llm_inference_latency_ms",
  help: "LLM inference latency in milliseconds",
  labelNames: ["provider", "model"] as const,
  buckets: [100, 500, 1000, 2000, 5000, 10000, 30000],
  registers: [registry],
});

export const dbQueryDuration = new Histogram({
  name: "db_query_duration_ms",
  help: "Database query duration in milliseconds",
  labelNames: ["operation"] as const,
  buckets: [1, 5, 10, 25, 50, 100, 500],
  registers: [registry],
});

export const dbQueryErrors = new Counter({
  name: "db_query_errors_total",
  help: "Total number of database query errors",
  labelNames: ["operation"] as const,
  registers: [registry],
});

export const activeSessions = new Gauge({
  name: "active_sessions_total",
  help: "Number of active user sessions",
  registers: [registry],
});

export const errorEventsTotal = new Counter({
  name: "error_events_total",
  help: "Total number of error events captured",
  labelNames: ["severity", "error_type"] as const,
  registers: [registry],
});

export function trackRequest(method: string, route: string): (statusCode: number) => void {
  const end = httpRequestDuration.startTimer({ method, route });
  httpRequestsInFlight.inc({ method, route });
  httpRequestTotal.inc({ method, route });

  return (statusCode: number) => {
    end({ status_code: statusCode });
    httpRequestsInFlight.dec({ method, route });
  };
}

export function trackLLMInference(
  provider: string,
  model: string,
  status: string,
  latencyMs: number,
  totalTokens: number,
) {
  llmInferenceTotal.inc({ provider, model, status });
  llmInferenceLatency.observe({ provider, model }, latencyMs);
  llmInferenceTokens.observe({ provider, model }, totalTokens);
}

export async function getMetricsContentType(): Promise<{ content: string; contentType: string }> {
  return {
    content: await registry.metrics(),
    contentType: registry.contentType,
  };
}

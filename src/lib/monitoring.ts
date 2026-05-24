import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "./db";
import { schema } from "./db";
import { logger } from "./logger";
import { errorEventsTotal } from "./metrics";
import { AppError } from "./errors";

export interface ErrorEvent {
  id: string;
  message: string;
  code: string;
  severity: "critical" | "error" | "warning" | "info";
  stack?: string;
  route?: string;
  method?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  digest?: string;
}

interface ErrorFilter {
  severity?: ErrorEvent["severity"];
  code?: string;
  route?: string;
  userId?: string;
  limit?: number;
  offset?: number;
  since?: Date;
}

const errorRateMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  let entry = errorRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60000 };
    errorRateMap.set(key, entry);
  }
  entry.count++;
  return entry.count > 10;
}

export async function captureError(
  error: Error,
  context?: {
    route?: string;
    method?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    severity?: ErrorEvent["severity"];
  },
): Promise<string> {
  const dedupKey = `${error.message}:${context?.route ?? "unknown"}`;
  if (isRateLimited(dedupKey)) {
    logger.warn({ error: error.message, route: context?.route }, "Error rate limited");
    return "";
  }

  const id = crypto.randomUUID();
  const digest = "digest" in error ? (error as Error & { digest: string }).digest : undefined;
  const code = error instanceof AppError ? error.code : "UNEXPECTED_ERROR";
  const severity = context?.severity ?? (error instanceof AppError ? "error" : "critical");

  const event: ErrorEvent = {
    id,
    message: error.message,
    code,
    severity,
    stack: error.stack,
    route: context?.route,
    method: context?.method,
    userId: context?.userId,
    metadata: {
      ...context?.metadata,
      ...(error instanceof AppError && error.metadata ? error.metadata : undefined),
      name: error.name,
      digest,
    },
    digest,
  };

  errorEventsTotal.inc({ severity, error_type: code });

  try {
    await db.insert(schema.errorEvents).values({
      id: event.id,
      message: event.message,
      code: event.code,
      severity: event.severity,
      stack: event.stack ?? null,
      route: event.route ?? null,
      method: event.method ?? null,
      userId: event.userId ?? null,
      metadata: event.metadata ?? null,
      digest: event.digest ?? null,
    });
  } catch {
    // Table might not exist before migration; error tracking is best-effort
  }

  logger.error(
    { err: error, eventId: id, route: context?.route, severity },
    `[${severity.toUpperCase()}] ${error.message}`,
  );

  return id;
}

export async function getErrorEvents(
  filter: ErrorFilter = {},
): Promise<{ events: ErrorEvent[]; total: number }> {
  const { severity, code, route, userId, limit = 50, offset = 0, since } = filter;

  try {
    const conditions = [
      severity ? eq(schema.errorEvents.severity, severity) : undefined,
      code ? eq(schema.errorEvents.code, code) : undefined,
      route ? eq(schema.errorEvents.route, route) : undefined,
      userId ? eq(schema.errorEvents.userId, userId) : undefined,
      since ? gt(schema.errorEvents.createdAt, since) : undefined,
    ].filter(Boolean) as ReturnType<typeof eq>[];

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(schema.errorEvents)
      .where(where)
      .orderBy(desc(schema.errorEvents.createdAt))
      .limit(limit)
      .offset(offset);

    const result = await db.select({ count: schema.errorEvents.id }).from(schema.errorEvents);
    const total = result.length;

    return {
      events: rows.map((e) => ({
        id: e.id,
        message: e.message,
        code: e.code,
        severity: e.severity as ErrorEvent["severity"],
        stack: e.stack ?? undefined,
        route: e.route ?? undefined,
        method: e.method ?? undefined,
        userId: e.userId ?? undefined,
        metadata: e.metadata as Record<string, unknown> | undefined,
        digest: e.digest ?? undefined,
      })),
      total,
    };
  } catch (err) {
    logger.error({ err }, "Failed to query error events");
    return { events: [], total: 0 };
  }
}

export async function clearErrorEvents() {
  try {
    await db.delete(schema.errorEvents);
    logger.info("All error events cleared");
  } catch (err) {
    logger.error({ err }, "Failed to clear error events");
  }
}

export function createRequestContext(request: {
  url?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}): { route: string; method: string } {
  const url = request.url ?? "";
  const pathname = url.includes("://") ? new URL(url).pathname : url;
  return {
    route: pathname || "/",
    method: request.method ?? "UNKNOWN",
  };
}

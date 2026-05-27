import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth/api";
import { logger } from "@/lib/logger";
import { AppError, AuthenticationError, AuthorizationError, ValidationError } from "@/lib/errors";

type RouteHandler = (req: NextRequest, context?: Record<string, unknown>) => Promise<NextResponse>;

interface WithRateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export function withRateLimit(handler: RouteHandler, options: WithRateLimitOptions): RouteHandler {
  return async (req: NextRequest, context?: Record<string, unknown>) => {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const { allowed, remaining } = await rateLimit(
      getRateLimitKey(ip, req.nextUrl.pathname),
      options,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests", remaining },
        { status: 429, headers: { "Retry-After": String(Math.ceil(options.windowMs / 1000)) } },
      );
    }
    return handler(req, context);
  };
}

export function withAuth(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context?: Record<string, unknown>) => {
    try {
      const session = await requireAuth();
      return handler(req, { ...context, session });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  };
}

type ExtendedHandler = (
  req: NextRequest,
  context?: Record<string, unknown>,
) => Promise<NextResponse>;

export function withErrorHandler(handler: ExtendedHandler): ExtendedHandler {
  return async (req: NextRequest, context?: Record<string, unknown>) => {
    try {
      return await handler(req, context);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { error: error.message, details: error.metadata },
          { status: 400 },
        );
      }
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode },
        );
      }

      logger.error({ err: error, path: req.nextUrl.pathname }, "Unhandled API error");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export function compose(...middlewares: Array<(handler: ExtendedHandler) => ExtendedHandler>) {
  return (handler: ExtendedHandler): ExtendedHandler =>
    middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
}

export function validateBody<T>(schema: { parse: (data: unknown) => T }, body: unknown): T {
  const result = schema.parse(body);
  return result;
}

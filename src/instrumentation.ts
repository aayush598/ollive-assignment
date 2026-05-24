import { type Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startIngestionListener } = await import("./lib/ingestion/postgres-listener");
      await startIngestionListener();
    } catch {
      // listener fallback is handled internally
    }

    try {
      const { ensureCollection } = await import("./lib/vector/qdrant");
      await ensureCollection();
    } catch {
      // Qdrant not available, skipping collection init
    }
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const { captureError } = await import("./lib/monitoring");

    const error =
      err instanceof Error ? err : new Error(typeof err === "string" ? err : String(err));
    const digest =
      err && typeof err === "object" && "digest" in err
        ? String((err as { digest: unknown }).digest)
        : undefined;

    await captureError(error, {
      route: request.path,
      method: request.method,
      severity: context.routeType === "route" ? "error" : "critical",
      metadata: {
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource,
        digest,
      },
    });
  } catch {
    // Error tracking unavailable in this runtime
  }
};

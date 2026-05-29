import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = ["http://localhost:3000", process.env.NEXT_PUBLIC_APP_URL].filter(
  Boolean,
) as string[];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

const isVercel = process.env.VERCEL === "1";
const isDev = process.env.NODE_ENV === "development";
const liveReload = isDev || isVercel ? " https://vercel.live" : "";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-eval' 'unsafe-inline'${liveReload}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report",
  "report-to csp-endpoint",
].join("; ");

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (request.method === "POST" && !isAllowedOrigin(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  const response = NextResponse.next();

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", cspDirectives);
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

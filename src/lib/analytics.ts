"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

let sessionId: string | null = null;
let deviceId: string | null = null;

function getOrCreateSessionId(): string {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem("asid");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("asid", sessionId);
    }
  } catch {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

function getOrCreateDeviceId(): string {
  if (deviceId) return deviceId;
  try {
    deviceId = localStorage.getItem("adid");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("adid", deviceId);
    }
  } catch {
    deviceId = crypto.randomUUID();
  }
  return deviceId;
}

function getPageMetadata() {
  return {
    path: window.location.pathname,
    url: window.location.href,
    referrer: document.referrer || undefined,
    title: document.title,
    lang: document.documentElement.lang,
    screen: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

async function sendEvent(
  type: string,
  data: Record<string, unknown> = {},
  opts: { priority?: boolean } = {},
) {
  try {
    const payload = {
      type,
      sessionId: getOrCreateSessionId(),
      deviceId: getOrCreateDeviceId(),
      timestamp: new Date().toISOString(),
      ...getPageMetadata(),
      ...data,
    };

    if (opts.priority || !navigator.sendBeacon) {
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } else {
      navigator.sendBeacon("/api/analytics", JSON.stringify(payload));
    }
  } catch {
    // Analytics failures are non-critical
  }
}

let previousPath: string | null = null;

export function useAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);
  const pageLoadTime = useRef(0);
  const initTime = useRef(0);

  useEffect(() => {
    initTime.current = Date.now();

    if (!initialized.current) {
      initialized.current = true;

      const pageData: Record<string, unknown> = {
        path: pathname,
        query: searchParams.toString() || undefined,
        loadTime: initTime.current,
      };

      sendEvent("page_view", pageData, { priority: true });
      previousPath = pathname;
      pageLoadTime.current = initTime.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (previousPath && previousPath !== pathname) {
      const timeOnPage = Date.now() - pageLoadTime.current;

      sendEvent("page_view", {
        path: pathname,
        query: searchParams.toString() || undefined,
        from: previousPath,
        timeOnPreviousPage: timeOnPage,
      });

      pageLoadTime.current = Date.now();
      previousPath = pathname;
    }
  }, [pathname, searchParams]);
}

export const analytics = {
  track(event: string, data: Record<string, unknown> = {}) {
    sendEvent(event, data);
  },

  identify(userId: string, traits?: Record<string, unknown>) {
    try {
      localStorage.setItem("auid", userId);
    } catch {
      // ignore
    }
    sendEvent("identify", { userId, traits });
  },

  page(path?: string) {
    sendEvent("page_view", {
      path: path ?? window.location.pathname,
      title: document.title,
    });
  },
};

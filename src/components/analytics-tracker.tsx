"use client";

import { useAnalytics } from "@/lib/analytics";

export function AnalyticsTracker() {
  useAnalytics();
  return null;
}

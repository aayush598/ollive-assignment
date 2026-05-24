"use client";

import { useReportWebVitals } from "next/web-vitals";

const metricLabels: Record<string, string> = {
  CLS: "cumulative_layout_shift",
  FID: "first_input_delay",
  LCP: "largest_contentful_paint",
  FCP: "first_contentful_paint",
  TTFB: "time_to_first_byte",
  INP: "interaction_to_next_paint",
};

export function WebVitals() {
  useReportWebVitals((metric) => {
    const label = metricLabels[metric.name] ?? metric.name.toLowerCase();

    const body: Record<string, unknown> = {
      type: "web_vital",
      metric: label,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", JSON.stringify(body));
    } else {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    }
  });

  return null;
}

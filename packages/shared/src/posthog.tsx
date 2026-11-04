"use client";

import posthog from "posthog-js";
import { useEffect, type ReactNode } from "react";

/** Initialises PostHog once and fires one `demo_viewed` event per page load. No-op without a key. */
export function PostHogProvider({ demo, children }: { demo: string; children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,
    });
    posthog.capture("demo_viewed", { demo });
  }, [demo]);
  return <>{children}</>;
}

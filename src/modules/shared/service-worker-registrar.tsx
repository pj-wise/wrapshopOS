"use client";

import { useEffect } from "react";

/**
 * Registers the service worker at `/sw.js` on the client. Renders nothing.
 * Skipped in development to avoid stale-worker gotchas during HMR.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        console.warn("[sw] registration failed", err);
      });
  }, []);

  return null;
}

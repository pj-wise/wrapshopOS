import type { MetadataRoute } from "next";

/**
 * PWA manifest. Icons are placeholders for now — replace with real branded
 * icons at /public/icons/{192,512,maskable-192,maskable-512}.png.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "autoLuxOS",
    short_name: "autoLuxOS",
    description:
      "Shop management built for wrap, tint, PPF, ceramic coating, and detailing businesses.",
    // Smart launcher: /launch dispatches to /dashboard when signed in or to
    // /calculator when not — much better first-run UX for a fresh install.
    start_url: "/launch",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Task shortcuts on long-press
    shortcuts: [
      { name: "Dashboard", url: "/dashboard" },
      { name: "Inbox", url: "/inbox" },
      { name: "Production Board", url: "/jobs" },
      { name: "Schedule", url: "/schedule" },
    ],
  };
}

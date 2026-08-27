import type { MetadataRoute } from "next";

/**
 * PWA manifest. Icons are placeholders for now — replace with real branded
 * icons at /public/icons/{192,512,maskable-192,maskable-512}.png.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WrapShop OS",
    short_name: "WrapShop",
    description:
      "Shop management for vinyl wrap, PPF, tint, and ceramic coating businesses.",
    start_url: "/dashboard",
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

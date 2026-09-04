import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/modules/shared/theme-provider";
import { ServiceWorkerRegistrar } from "@/modules/shared/service-worker-registrar";

import "./globals.css";

// Inter — the anchor tech-UI font (Linear, Notion, GitHub, Vercel dashboards).
// Variable weight, tabular figures for numeric tables, feature-rich for text.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

// JetBrains Mono — clean monospace for VINs, invoice numbers, IDs, code.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "autoLuxOS",
  description:
    "Shop management built for wrap, tint, PPF, ceramic coating, and detailing businesses.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}

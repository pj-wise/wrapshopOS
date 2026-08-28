import type { ReactNode } from "react";

/**
 * Minimal shell for tokenized mobile routes (`/m/*`). No sidebar, no top
 * nav, no auth gate — the token in the path is the auth. Kept intentionally
 * bare so a phone browser has full width and the shop's tech can capture
 * photos without desktop chrome getting in the way.
 */
export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      {children}
    </div>
  );
}

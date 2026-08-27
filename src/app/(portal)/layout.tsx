import { TRPCProvider } from "@/lib/trpc/provider";

/**
 * Portal layout — public magic-link pages. No auth. No app shell. tRPC
 * is available for the portal.* procedures.
 */
export default function PortalLayout({ children }: LayoutProps<"/">) {
  return (
    <TRPCProvider>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">{children}</div>
    </TRPCProvider>
  );
}

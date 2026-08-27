import { getAppSession } from "@/server/auth/session";
import { featureService } from "@/server/features/service";
import { AppShell } from "@/modules/shared/app-shell";
import { TRPCProvider } from "@/lib/trpc/provider";

export default async function AuthenticatedLayout({
  children,
}: LayoutProps<"/">) {
  const session = await getAppSession();
  const features = await featureService.resolveAll({
    orgId: session.organizationId,
    orgTier: session.organizationTier,
    userId: session.userId,
    locationId: session.locationId,
  });

  return (
    <TRPCProvider>
      <AppShell session={session} features={features}>
        {children}
      </AppShell>
    </TRPCProvider>
  );
}

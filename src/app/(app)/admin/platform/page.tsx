import { redirect } from "next/navigation";

import { getAppSession } from "@/server/auth/session";
import { PlatformOrgsPanel } from "@/modules/admin/platform-orgs-panel";

export const metadata = {
  title: "Platform admin",
};

/**
 * Cross-org control panel for the WrapShop-OS operator. Guarded server-side
 * by the platform-admin bit on the session (env-driven allow list). Users
 * who aren't platform admins get bounced to the shop-scoped settings page.
 */
export default async function Page() {
  const session = await getAppSession();
  if (!session.isPlatformAdmin) redirect("/admin/settings");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as <strong>{session.email}</strong>. Every organization on
          this deployment is listed below — flip a tier to test gated features
          without touching Postgres.
        </p>
      </div>

      <PlatformOrgsPanel />
    </div>
  );
}

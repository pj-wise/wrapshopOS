import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Set up your shop</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Give your organization a name. You can add locations, team members, and
        integrations after this.
      </p>
      <div className="mt-8">
        <OnboardingForm email={user.email ?? ""} />
      </div>
    </div>
  );
}

import { getAppSession } from "@/server/auth/session";

import { PasswordForm } from "./password-form";

export default async function Page() {
  const session = await getAppSession();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set a password for <strong>{session.email}</strong> so you can sign in
          without waiting on an emailed code.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <PasswordForm />
      </div>
    </div>
  );
}

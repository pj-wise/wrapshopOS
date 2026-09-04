import { Suspense } from "react";

import { AuthErrorBanner } from "./auth-error-banner";
import { SignInForm } from "./sign-in-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2 font-semibold tracking-tight">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
            aL
          </div>
          <span>autoLuxOS</span>
        </div>

        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">
          Use your password, or have a 6-digit code emailed to you.
        </p>

        {/* Both children read search params, so they need a Suspense boundary. */}
        <Suspense fallback={null}>
          <AuthErrorBanner />
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}

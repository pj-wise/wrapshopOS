import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Check your email · autoLuxOS",
};

/**
 * Landed here after a successful signUp when Supabase requires email
 * confirmation before the account can sign in. The Organization is
 * ALREADY created (see signUpAction) — the user just needs to click the
 * confirmation link, then they land on /auth/callback → /dashboard.
 */
export default async function VerifyPage(props: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await props.searchParams;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Home
      </Link>

      <div className="rounded-lg border bg-card p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
          <Mail className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to{" "}
          {email ? (
            <span className="font-medium text-foreground">{email}</span>
          ) : (
            <span className="font-medium text-foreground">
              your inbox
            </span>
          )}
          . Click it to finish setting up your autoLuxOS account.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Your business profile is already saved — you&apos;ll land directly on
          your dashboard once verified.
        </p>

        <div className="mt-6 space-y-2 text-sm">
          <p className="text-muted-foreground">
            Didn&apos;t get it? Check your spam folder, or{" "}
            <Link href="/login" className="font-medium text-foreground hover:underline">
              try signing in
            </Link>{" "}
            — some email providers deliver the confirmation as part of the
            first login.
          </p>
        </div>
      </div>
    </div>
  );
}

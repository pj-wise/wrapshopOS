import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SignUpForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account · autoLuxOS",
  description:
    "Start your free autoLuxOS account. Unlimited quotes and jobs — even on Free.",
};

export default function SignUpPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Home
      </Link>

      <div className="mb-6 flex items-center gap-2 font-semibold tracking-tight">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
          aL
        </div>
        <span className="text-lg">autoLuxOS</span>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Create your free account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unlimited customers, quotes, and jobs. Upgrade only when you want
          e-signatures, payments, or team features.
        </p>
      </div>

      <SignUpForm />

      <p className="mt-8 text-center text-xs text-muted-foreground">
        By creating an account you agree to our terms and acknowledge our
        privacy notice. No credit card required.
      </p>
    </div>
  );
}

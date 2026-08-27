"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createOrganizationAction } from "./actions";

export function OnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createOrganizationAction({ name });
      if (result.ok) {
        toast.success("Shop created.");
        router.push("/dashboard");
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        Signed in as <strong className="text-neutral-900 dark:text-neutral-100">{email}</strong>
      </div>
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium">
          Shop name
        </label>
        <input
          id="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          placeholder="Apex Restyling"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={loading || name.trim().length < 2}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm text-neutral-50 hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {loading ? "Creating…" : "Create shop"}
      </button>
    </form>
  );
}

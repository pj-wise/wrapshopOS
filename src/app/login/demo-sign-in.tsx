"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";
import { enterDemoAction, signInDemoAction } from "@/server/demo/actions";

/** Sign-in for demo mode (see src/lib/demo.ts) — replaces the Supabase form. */
export function DemoSignIn() {
  const next = useSearchParams().get("next") ?? undefined;
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await signInDemoAction(email, password, next);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() => startTransition(() => enterDemoAction(next))}
      >
        {pending ? "Opening demo…" : "Explore the demo"}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or sign in
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="demo-email">Email</Label>
          <Input
            id="demo-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo-password">Password</Label>
          <Input
            id="demo-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={pending}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Demo mode — sample data, resets when the server restarts.
      </p>
    </div>
  );
}

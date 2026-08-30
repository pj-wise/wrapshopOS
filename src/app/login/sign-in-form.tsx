"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Mode = "password" | "code";

/**
 * Must match Authentication → Emails → Email OTP Length in the Supabase
 * dashboard. If that setting changes, change this too.
 */
const OTP_LENGTH = 6;

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * `/dashboard` is safe to land on even for a brand-new account:
   * `getAppSession()` redirects to `/onboarding` when there's no active
   * OrgMember, so we don't duplicate that branch here.
   */
  function finish() {
    router.push(next);
    router.refresh();
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        // Accounts created under the old magic-link flow have no password at
        // all, and Supabase reports that as ordinary bad credentials.
        if (/invalid login credentials/i.test(error.message)) {
          toast.error(
            "Wrong email or password. No password set yet? Use “Email a code”.",
          );
          return;
        }
        throw error;
      }
      finish();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  async function onRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // No `emailRedirectTo` — passing it is what makes Supabase render a
      // clickable link, and links get burned by email/security scanners
      // before the human ever clicks them.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setCodeSent(true);
      toast.success("Code sent — check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const token = code.trim();

      let { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      // A brand-new, never-confirmed account is sent Supabase's "Confirm
      // signup" template, whose token verifies under `signup` instead.
      if (error && /token type/i.test(error.message)) {
        ({ error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: "signup",
        }));
      }
      if (error) throw error;
      finish();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Tabs
      value={mode}
      onValueChange={(value) => {
        setMode(value as Mode);
        setCodeSent(false);
        setCode("");
      }}
    >
      <TabsList className="w-full">
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="code">Email a code</TabsTrigger>
      </TabsList>

      <TabsContent value="password" className="pt-4">
        <form onSubmit={onPasswordSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !email || !password}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              className="underline underline-offset-4 hover:text-foreground"
              onClick={() => setMode("code")}
            >
              Forgot your password?
            </button>
          </p>
        </form>
      </TabsContent>

      <TabsContent value="code" className="pt-4">
        {codeSent ? (
          <form onSubmit={onVerifyCode} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We emailed a {OTP_LENGTH}-digit code to <strong>{email}</strong>.
            </p>
            <div>
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern={`[0-9]{${OTP_LENGTH}}`}
                maxLength={OTP_LENGTH}
                required
                autoFocus
                placeholder="000000"
                className="text-center font-mono text-lg tracking-[0.5em]"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
                }
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || code.length !== OTP_LENGTH}
            >
              {loading ? "Verifying…" : "Verify and sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <button
                type="button"
                className="underline underline-offset-4 hover:text-foreground"
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                }}
              >
                Use a different email or resend
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={onRequestCode} className="space-y-4">
            <div>
              <Label htmlFor="code-email">Email</Label>
              <Input
                id="code-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? "Sending…" : "Email me a code"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New here? This creates your account too.
            </p>
          </form>
        )}
      </TabsContent>
    </Tabs>
  );
}

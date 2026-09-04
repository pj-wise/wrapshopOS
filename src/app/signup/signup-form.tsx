"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, Building2, Eye, EyeOff, HelpCircle, Loader2, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  INVOICING_TOOLS,
  SCHEDULING_TOOLS,
  SERVICE_KEYS,
  signUpInput,
  type InvoicingTool,
  type SchedulingTool,
  type ServiceKey,
  type SignUpInput,
} from "@/lib/schemas/signup";

import { signUpAction } from "./actions";

// UI labels — kept out of the schema module so it stays validation-only.
const SERVICE_LABELS: Record<ServiceKey, string> = {
  wrap: "Vinyl wrap",
  tint: "Window tint",
  ppf: "Paint protection film (PPF)",
  ceramic: "Ceramic coating",
  detailing: "Detailing",
  other: "Other",
};

const SCHEDULING_LABELS: Record<SchedulingTool, string> = {
  none: "Nothing yet",
  google_calendar: "Google Calendar",
  acuity: "Acuity / Calendly",
  booksy: "Booksy",
  paper: "Paper / spreadsheet",
  other: "Other",
};

const INVOICING_LABELS: Record<InvoicingTool, string> = {
  none: "Nothing yet",
  quickbooks: "QuickBooks",
  square: "Square",
  stripe: "Stripe",
  paypal: "PayPal",
  pdf: "Word / PDF",
  other: "Other",
};

const NONE_SELECT = "__none__";

type FormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  personalPhone: string;
  businessName: string;
  shopPhone: string;
  servicesOffered: Set<ServiceKey>;
  currentScheduling: SchedulingTool | "";
  currentInvoicing: InvoicingTool | "";
};

const EMPTY_FORM: FormState = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  personalPhone: "",
  businessName: "",
  shopPhone: "",
  servicesOffered: new Set(),
  currentScheduling: "",
  currentInvoicing: "",
};

export function SignUpForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function toggleService(key: ServiceKey, checked: boolean) {
    setForm((s) => {
      const next = new Set(s.servicesOffered);
      if (checked) next.add(key);
      else next.delete(key);
      return { ...s, servicesOffered: next };
    });
  }

  // Client-side gate on submit button — mirrors the zod schema minimums so
  // the button only enables when the server would accept it.
  const canSubmit =
    form.email.length > 0 &&
    form.password.length >= 8 &&
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.businessName.trim().length >= 2 &&
    form.shopPhone.trim().length >= 7 &&
    form.servicesOffered.size > 0 &&
    !pending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);

    const payload: SignUpInput = {
      email: form.email,
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
      personalPhone: form.personalPhone || undefined,
      businessName: form.businessName,
      shopPhone: form.shopPhone,
      servicesOffered: Array.from(form.servicesOffered),
      currentScheduling:
        form.currentScheduling === "" ? undefined : form.currentScheduling,
      currentInvoicing:
        form.currentInvoicing === "" ? undefined : form.currentInvoicing,
    };

    // Belt-and-suspenders client validate first.
    const validated = signUpInput.safeParse(payload);
    if (!validated.success) {
      const first = validated.error.issues[0];
      setFieldError(first?.message ?? "Some fields are missing or invalid.");
      return;
    }

    startTransition(async () => {
      const res = await signUpAction(validated.data);
      if (!res.ok) {
        setFieldError(res.error);
        toast.error(res.error);
        return;
      }
      if (res.needsEmailVerify) {
        router.push(`/signup/verify?email=${encodeURIComponent(form.email)}`);
        return;
      }
      toast.success("Account created — welcome!");
      router.push("/dashboard");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Section 1: account holder */}
      <Section
        icon={<User className="h-4 w-4" />}
        title="Your account"
        subtitle="This is what you'll use to sign in."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="signup-first">First name *</Label>
            <Input
              id="signup-first"
              autoComplete="given-name"
              required
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="signup-last">Last name *</Label>
            <Input
              id="signup-last"
              autoComplete="family-name"
              required
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="signup-email">Email *</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@yourshop.com"
          />
        </div>
        <div>
          <Label htmlFor="signup-password">Password *</Label>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        </div>
        <div>
          <Label htmlFor="signup-phone">Personal phone (optional)</Label>
          <Input
            id="signup-phone"
            type="tel"
            autoComplete="tel"
            value={form.personalPhone}
            onChange={(e) => set("personalPhone", e.target.value)}
            placeholder="For account recovery, never customer-facing."
          />
        </div>
      </Section>

      {/* Section 2: business */}
      <Section
        icon={<Building2 className="h-4 w-4" />}
        title="Your business"
        subtitle="You can change any of this later."
      >
        <div>
          <Label htmlFor="signup-business">Legal business name *</Label>
          <Input
            id="signup-business"
            required
            value={form.businessName}
            onChange={(e) => set("businessName", e.target.value)}
            placeholder="e.g. Ntense Car Wraps LLC"
          />
        </div>
        <div>
          <Label htmlFor="signup-shop-phone">Shop phone *</Label>
          <Input
            id="signup-shop-phone"
            type="tel"
            required
            value={form.shopPhone}
            onChange={(e) => set("shopPhone", e.target.value)}
            placeholder="Customer-facing shop number"
          />
        </div>
        <div>
          <Label>Services offered *</Label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SERVICE_KEYS.map((key) => {
              const checked = form.servicesOffered.has(key);
              return (
                <label
                  key={key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    checked
                      ? "border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900"
                      : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleService(key, e.target.checked)}
                    className="h-4 w-4 accent-neutral-900 dark:accent-neutral-100"
                  />
                  {SERVICE_LABELS[key]}
                </label>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Section 3: questionnaire */}
      <Section
        icon={<HelpCircle className="h-4 w-4" />}
        title="What are you using today?"
        subtitle="Optional — helps us tailor your setup + integrations."
      >
        <div>
          <Label htmlFor="signup-scheduling">Scheduling</Label>
          <Select
            value={form.currentScheduling || NONE_SELECT}
            onValueChange={(v) =>
              set(
                "currentScheduling",
                !v || v === NONE_SELECT ? "" : (v as SchedulingTool),
              )
            }
          >
            <SelectTrigger id="signup-scheduling">
              <SelectValue placeholder="Pick one (or skip)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_SELECT}>—</SelectItem>
              {SCHEDULING_TOOLS.map((t) => (
                <SelectItem key={t} value={t}>
                  {SCHEDULING_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="signup-invoicing">Invoicing</Label>
          <Select
            value={form.currentInvoicing || NONE_SELECT}
            onValueChange={(v) =>
              set(
                "currentInvoicing",
                !v || v === NONE_SELECT ? "" : (v as InvoicingTool),
              )
            }
          >
            <SelectTrigger id="signup-invoicing">
              <SelectValue placeholder="Pick one (or skip)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_SELECT}>—</SelectItem>
              {INVOICING_TOOLS.map((t) => (
                <SelectItem key={t} value={t}>
                  {INVOICING_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

      {fieldError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {fieldError}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={!canSubmit}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
            {icon}
          </span>
          {title}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-4">{children}</div>
    </section>
  );
}

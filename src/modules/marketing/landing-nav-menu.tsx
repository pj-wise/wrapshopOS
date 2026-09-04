"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Unified marketing nav — hamburger button on every breakpoint, opens a
 * right-side Sheet with every landing-page link (Calculator pill, Pricing,
 * Sign in, Create account). Deliberately not split into desktop vs mobile
 * layouts — keeps the header row uncluttered and predictable across sizes.
 *
 * Menu items close the sheet on click via `onNavigate`.
 */
export function LandingNavMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open menu"
          />
        }
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>

      <SheetContent side="right" className="p-6">
        <SheetHeader className="p-0">
          <SheetTitle className="text-lg">Menu</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Calculator — the highlight item, same pill styling as before. */}
          <Link
            href="/calculator"
            onClick={close}
            className="group relative flex items-center justify-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900 shadow-sm transition-all hover:border-emerald-500 hover:bg-emerald-100 hover:shadow-md dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/50"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Pricing Calculator
            <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
              Free
            </span>
          </Link>

          {/* Other landing sections. */}
          <nav className="space-y-1">
            <MenuLink href="/pricing" onNavigate={close}>
              Pricing
            </MenuLink>
            <MenuLink href="/#features" onNavigate={close}>
              Features
            </MenuLink>
          </nav>

          <div className="h-px bg-border" />

          {/* Auth actions. */}
          <div className="space-y-3">
            <Link
              href="/login"
              onClick={close}
              className="flex w-full items-center justify-center gap-1 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/signup"
              onClick={close}
              className="flex w-full items-center justify-center rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Create an account
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5 opacity-40" />
    </Link>
  );
}

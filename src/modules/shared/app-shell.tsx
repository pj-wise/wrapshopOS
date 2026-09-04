import Link from "next/link";
import type { ReactNode } from "react";
import {
  Calculator,
  LayoutDashboard,
  Inbox,
  Users,
  Car,
  UserPlus,
  FileText,
  Wrench,
  Calendar,
  Package,
  PackageOpen,
  Receipt,
  BarChart3,
  Settings,
  Building2,
  Zap,
} from "lucide-react";

import type { AppSession } from "@/server/auth/session";
import { UserMenu } from "./user-menu";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { FeatureProvider } from "@/hooks/use-features";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ResolvedFeature } from "@/server/features/service";
import type { FeatureKey } from "@/lib/features";

const NAV_SECTIONS = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
      { href: "/inbox", label: "Inbox", icon: Inbox, permission: "messaging:read" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/leads", label: "Leads", icon: UserPlus, permission: "crm:read" },
      { href: "/customers", label: "Customers", icon: Users, permission: "crm:read" },
      { href: "/vehicles", label: "Vehicles", icon: Car, permission: "crm:read" },
      { href: "/quotes", label: "Quotes", icon: FileText, permission: "quotes:read" },
      { href: "/pricing-calculator", label: "Pricing Calculator", icon: Calculator, permission: "quotes:read" },
      { href: "/products", label: "Products", icon: PackageOpen, permission: "settings:read" },
    ],
  },
  {
    label: "Production",
    items: [
      { href: "/jobs", label: "Jobs & Board", icon: Wrench, permission: "jobs:read" },
      { href: "/schedule", label: "Schedule", icon: Calendar, permission: "scheduling:read" },
      { href: "/inventory", label: "Inventory", icon: Package, permission: "inventory:read" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/invoices", label: "Invoices", icon: Receipt, permission: "invoices:read" },
      { href: "/reports", label: "Reports", icon: BarChart3, permission: "reports:read" },
    ],
  },
  {
    label: "Shop",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings:read" },
      { href: "/admin/integrations", label: "Integrations", icon: Building2, permission: "admin:integrations" },
    ],
  },
] as const;

export function AppShell({
  session,
  features,
  children,
}: {
  session: AppSession;
  features: Record<FeatureKey, ResolvedFeature>;
  children: ReactNode;
}) {
  return (
    <FeatureProvider features={features}>
      <TooltipProvider>
      <CommandPalette>
        {/*
          Layout owns the viewport: `h-dvh overflow-hidden` pins the outer
          shell so horizontal overflow inside <main> (e.g. the Kanban board)
          scrolls only that region — the sidebar + top header stay put.
          `min-w-0` on the middle column is required for a flex child to
          allow its content to shrink below its intrinsic width instead of
          pushing the sidebar off-screen.
        */}
        <div className="flex h-dvh overflow-hidden">
          <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-4 lg:block dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-6 flex items-center gap-2 px-2 font-semibold tracking-tight">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
                W
              </div>
              <span className="truncate">{session.organizationName}</span>
            </div>
            <nav className="space-y-6">
              {NAV_SECTIONS.map((section) => {
                const visible = section.items.filter(
                  (item) =>
                    !item.permission || session.permissions.has(item.permission),
                );
                if (visible.length === 0) return null;
                return (
                  <div key={section.label}>
                    <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
                      {section.label}
                    </p>
                    <ul className="space-y-0.5">
                      {visible.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
                          >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {/* Platform-operator section — only visible for allow-listed
                  emails via `PLATFORM_ADMIN_EMAILS`. Not a role. */}
              {session.isPlatformAdmin && (
                <div>
                  <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    Platform
                  </p>
                  <ul className="space-y-0.5">
                    <li>
                      <Link
                        href="/admin/platform"
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      >
                        <Zap className="h-4 w-4" />
                        Orgs &amp; tiers
                      </Link>
                    </li>
                  </ul>
                </div>
              )}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 py-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-3 text-sm">
                <kbd className="hidden rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 md:inline dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
                  ⌘K
                </kbd>
                <span className="text-neutral-500">to search or run a command</span>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <UserMenu
                  email={session.email}
                  name={session.name}
                  roleKey={session.roleKey}
                />
              </div>
            </header>
            <main className="scrollbar-always flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </CommandPalette>
      </TooltipProvider>
    </FeatureProvider>
  );
}

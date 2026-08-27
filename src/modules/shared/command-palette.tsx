"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
  useKBar,
  useRegisterActions,
  type Action,
} from "kbar";
import {
  Car,
  FileText,
  UserPlus,
  Users,
  Wrench,
  Calendar,
  Receipt,
  Package,
  Inbox,
  LayoutDashboard,
  Search as SearchIcon,
} from "lucide-react";

import { trpc } from "@/lib/trpc/client";

function staticActions(router: ReturnType<typeof useRouter>): Action[] {
  return [
    { id: "goto-dashboard", name: "Go to Dashboard", section: "Navigate", keywords: "dashboard home", icon: <LayoutDashboard className="h-4 w-4" />, perform: () => router.push("/dashboard") },
    { id: "goto-inbox", name: "Go to Inbox", section: "Navigate", icon: <Inbox className="h-4 w-4" />, perform: () => router.push("/inbox") },
    { id: "goto-leads", name: "Go to Leads", section: "Navigate", icon: <UserPlus className="h-4 w-4" />, perform: () => router.push("/leads") },
    { id: "goto-customers", name: "Go to Customers", section: "Navigate", icon: <Users className="h-4 w-4" />, perform: () => router.push("/customers") },
    { id: "goto-vehicles", name: "Go to Vehicles", section: "Navigate", icon: <Car className="h-4 w-4" />, perform: () => router.push("/vehicles") },
    { id: "goto-quotes", name: "Go to Quotes", section: "Navigate", icon: <FileText className="h-4 w-4" />, perform: () => router.push("/quotes") },
    { id: "goto-jobs", name: "Go to Jobs", section: "Navigate", icon: <Wrench className="h-4 w-4" />, perform: () => router.push("/jobs") },
    { id: "goto-schedule", name: "Go to Schedule", section: "Navigate", icon: <Calendar className="h-4 w-4" />, perform: () => router.push("/schedule") },
    { id: "goto-inventory", name: "Go to Inventory", section: "Navigate", icon: <Package className="h-4 w-4" />, perform: () => router.push("/inventory") },
    { id: "goto-invoices", name: "Go to Invoices", section: "Navigate", icon: <Receipt className="h-4 w-4" />, perform: () => router.push("/invoices") },
    { id: "create-customer", name: "Create Customer", section: "Create", keywords: "new customer add", icon: <Users className="h-4 w-4" />, perform: () => router.push("/customers?new=1") },
    { id: "create-lead", name: "Create Lead", section: "Create", icon: <UserPlus className="h-4 w-4" />, perform: () => router.push("/leads?new=1") },
    { id: "create-vehicle", name: "Add Vehicle", section: "Create", icon: <Car className="h-4 w-4" />, perform: () => router.push("/vehicles?new=1") },
  ];
}

/**
 * Watches the palette's search box and (when the user has typed 2+ chars)
 * fires `search.global` via tRPC + registers the results as dynamic kbar
 * actions. Debounced 150ms.
 */
function SearchRegistrar() {
  const router = useRouter();
  const { searchQuery } = useKBar((state) => ({ searchQuery: state.searchQuery }));
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchQuery), 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const q = trpc.search.global.useQuery(
    { q: debounced, limit: 5 },
    { enabled: debounced.trim().length >= 2, staleTime: 30_000 },
  );

  const results = q.data;
  const dynamic: Action[] = [];
  if (results) {
    for (const c of results.customers) {
      dynamic.push({
        id: `hit-customer-${c.id}`,
        name: c.label,
        subtitle: c.sublabel ?? undefined,
        section: "Customers",
        icon: <Users className="h-4 w-4" />,
        perform: () => router.push(`/customers/${c.id}`),
      });
    }
    for (const v of results.vehicles) {
      dynamic.push({
        id: `hit-vehicle-${v.id}`,
        name: v.label,
        subtitle: v.sublabel ?? undefined,
        section: "Vehicles",
        icon: <Car className="h-4 w-4" />,
        perform: () => router.push(`/vehicles/${v.id}`),
      });
    }
    for (const l of results.leads) {
      dynamic.push({
        id: `hit-lead-${l.id}`,
        name: l.label,
        subtitle: l.sublabel ?? undefined,
        section: "Leads",
        icon: <UserPlus className="h-4 w-4" />,
        perform: () => router.push(`/leads/${l.id}`),
      });
    }
  }
  useRegisterActions(dynamic, [dynamic.map((a) => a.id).join(",")]);

  return null;
}

function CommandInner({ children }: { children: ReactNode }) {
  return (
    <>
      <KBarPortal>
        <KBarPositioner className="z-50 bg-black/60 backdrop-blur-sm">
          <KBarAnimator className="w-full max-w-xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-200 px-4 dark:border-neutral-800">
              <SearchIcon className="h-4 w-4 text-neutral-500" />
              <KBarSearch
                className="w-full bg-transparent py-3 text-sm outline-none"
                placeholder="Search customers, vehicles, leads — or run a command…"
              />
            </div>
            <ResultsList />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      <SearchRegistrar />
      {children}
    </>
  );
}

function ResultsList() {
  const { results } = useMatches();
  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === "string" ? (
          <div className="bg-neutral-50 px-4 py-1 text-[10px] font-medium uppercase tracking-widest text-neutral-500 dark:bg-neutral-900">
            {item}
          </div>
        ) : (
          <div
            className={`flex items-center gap-3 px-4 py-2 text-sm ${
              active
                ? "bg-neutral-100 dark:bg-neutral-900"
                : "bg-white dark:bg-neutral-950"
            }`}
          >
            {item.icon}
            <div className="flex flex-col">
              <span>{item.name}</span>
              {item.subtitle && (
                <span className="text-xs text-neutral-500">{item.subtitle}</span>
              )}
            </div>
          </div>
        )
      }
    />
  );
}

export function CommandPalette({ children }: { children: ReactNode }) {
  const router = useRouter();
  const actions = staticActions(router);
  return (
    <KBarProvider actions={actions}>
      <CommandInner>{children}</CommandInner>
    </KBarProvider>
  );
}

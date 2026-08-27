"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Notification bell in the app header. Polls every 30s (cheap query) — a
 * Realtime subscription is the next-up upgrade (Supabase channel keyed on
 * userId).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const q = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const markRead = trpc.notifications.markRead.useMutation();
  const markAll = trpc.notifications.markAllRead.useMutation();
  const utils = trpc.useUtils();

  const unread = q.data?.unread ?? 0;

  async function onMarkRead(id: string) {
    await markRead.mutateAsync({ id });
    await utils.notifications.list.invalidate();
  }

  async function onMarkAll() {
    await markAll.mutateAsync();
    await utils.notifications.list.invalidate();
  }

  return (
    <div className="relative">
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[9px] tabular-nums">
            {unread > 99 ? "99+" : unread}
          </Badge>
        )}
      </Button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-80 rounded-md border bg-popover shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Notifications
            </span>
            {unread > 0 && (
              <Button size="sm" variant="ghost" onClick={onMarkAll}>
                <CheckCheck className="mr-1 h-3 w-3" /> Mark all read
              </Button>
            )}
          </div>
          <ul className="max-h-96 divide-y overflow-y-auto">
            {(q.data?.items ?? []).length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                No notifications.
              </li>
            ) : (
              q.data?.items.map((n) => {
                const entityUrl = notificationEntityUrl(n.entityRef as Record<string, unknown>);
                const inner = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{n.title}</div>
                        {n.body && (
                          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {n.body}
                          </div>
                        )}
                      </div>
                      {!n.readAt && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onMarkRead(n.id);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-accent"
                          title="Mark read"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </>
                );
                return (
                  <li
                    key={n.id}
                    className={`px-3 py-2 ${n.readAt ? "" : "bg-accent/30"}`}
                  >
                    {entityUrl ? (
                      <Link
                        href={entityUrl}
                        onClick={() => setOpen(false)}
                        className="block hover:opacity-90"
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function notificationEntityUrl(ref: Record<string, unknown> | null): string | null {
  if (!ref || typeof ref !== "object") return null;
  const url = ref.url;
  if (typeof url === "string" && url.length > 0) return url;
  const entityType = ref.entityType;
  const entityId = ref.entityId;
  if (typeof entityType !== "string" || typeof entityId !== "string") return null;
  const map: Record<string, string> = {
    customer: `/customers/${entityId}`,
    vehicle: `/vehicles/${entityId}`,
    quote: `/quotes/${entityId}`,
    job: `/jobs/${entityId}`,
    lead: `/leads/${entityId}`,
    thread: `/inbox?thread=${entityId}`,
  };
  return map[entityType] ?? null;
}

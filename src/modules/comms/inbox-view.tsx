"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  Inbox as InboxIcon,
  Mail,
  MessageSquare,
  Send,
  User,
} from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Unified inbox — two-pane layout.
 *
 * Left: thread list (sorted by most recent activity).
 * Right: selected thread with message history + reply composer.
 *
 * Realtime broadcast (Supabase Realtime channel per-org) is the next-up
 * hardening item; today we refetch on send/mark-read for immediate UI updates.
 */
export function InboxView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const threadsQ = trpc.inbox.listThreads.useQuery();

  return (
    <div className="mx-auto max-w-full">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every conversation with every customer, across channels.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        <ThreadList
          items={threadsQ.data?.items ?? []}
          isLoading={threadsQ.isLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {selectedId ? (
          <ThreadPane id={selectedId} />
        ) : (
          <div className="hidden rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground md:block">
            <InboxIcon className="mx-auto mb-3 h-8 w-8 opacity-40" />
            Select a conversation on the left.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ThreadList({
  items,
  isLoading,
  selectedId,
  onSelect,
}: {
  items: Array<{
    id: string;
    channel: string;
    subject: string | null;
    lastMessageAt: Date;
    lastMessagePreview: string | null;
    status: string;
    unreadCount: number;
    customer: { id: string; name: string; email: string | null } | null;
  }>;
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <InboxIcon className="mx-auto mb-2 h-6 w-6" />
        No conversations yet. Sending a quote or messaging a customer will start one.
      </div>
    );
  }
  return (
    <ul className="max-h-[75vh] divide-y overflow-y-auto rounded-lg border bg-card">
      {items.map((t) => {
        const selected = t.id === selectedId;
        return (
          <li
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`cursor-pointer px-3 py-2.5 transition ${
              selected ? "bg-accent" : "hover:bg-accent/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <ChannelIcon channel={t.channel} />
                <span className="truncate text-sm font-medium">
                  {t.customer?.name ?? "(no customer)"}
                </span>
              </div>
              {t.unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[10px]">
                  {t.unreadCount}
                </Badge>
              )}
            </div>
            {t.subject && (
              <div className="mt-1 truncate text-xs font-medium">{t.subject}</div>
            )}
            {t.lastMessagePreview && (
              <div className="truncate text-xs text-muted-foreground">
                {t.lastMessagePreview}
              </div>
            )}
            <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {new Date(t.lastMessageAt).toLocaleDateString()}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "sms") return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />;
  if (channel === "internal") return <User className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Mail className="h-3.5 w-3.5 text-muted-foreground" />;
}

// ---------------------------------------------------------------------------

function ThreadPane({ id }: { id: string }) {
  const threadQ = trpc.inbox.getThread.useQuery({ id });
  const markRead = trpc.inbox.markRead.useMutation();
  const utils = trpc.useUtils();

  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const templates = trpc.templates.list.useQuery({ channel: "email" });
  const reply = trpc.inbox.reply.useMutation();
  const preview = trpc.inbox.renderTemplateFor.useQuery(
    {
      templateId,
      customerId: threadQ.data?.customer?.id,
    },
    { enabled: Boolean(templateId && threadQ.data?.customer?.id) },
  );

  if (threadQ.isLoading) return <Skeleton className="h-96" />;
  if (threadQ.error) return <p className="text-sm text-red-600">{threadQ.error.message}</p>;
  const thread = threadQ.data!;

  async function onMarkRead() {
    if (thread.unreadCount === 0) return;
    try {
      await markRead.mutateAsync({ id });
      await utils.inbox.listThreads.invalidate();
      await utils.inbox.getThread.invalidate({ id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onApplyTemplate(tid: string) {
    setTemplateId(tid);
    // Wait for preview to fetch and populate.
    // React Query returns the render lazily — set subject/body from a manual fetch.
    try {
      const rendered = await utils.inbox.renderTemplateFor.fetch({
        templateId: tid,
        customerId: thread.customer?.id,
      });
      if (rendered.subject) setSubject(rendered.subject);
      setBody(rendered.body);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    }
  }

  async function onSend() {
    try {
      await reply.mutateAsync({
        threadId: id,
        subject: subject || undefined,
        bodyText: body,
      });
      toast.success("Reply sent.");
      setBody("");
      setTemplateId("");
      await utils.inbox.getThread.invalidate({ id });
      await utils.inbox.listThreads.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    }
  }

  return (
    <div className="flex min-h-[75vh] flex-col rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ChannelIcon channel={thread.channel} />
            <h2 className="font-medium">
              {thread.customer ? (
                <Link href={`/customers/${thread.customer.id}`} className="hover:underline">
                  {thread.customer.name}
                </Link>
              ) : (
                "(no customer)"
              )}
            </h2>
            <Badge variant="outline" className="text-[10px] capitalize">
              {thread.status}
            </Badge>
          </div>
          {thread.subject && (
            <div className="mt-1 text-sm text-muted-foreground">{thread.subject}</div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onMarkRead} disabled={thread.unreadCount === 0}>
          Mark read
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {thread.messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">No messages yet.</div>
        ) : (
          thread.messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg border px-3 py-2 text-sm ${
                  m.direction === "out"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
              >
                {m.subject && (
                  <div className="mb-1 text-xs font-medium opacity-80">{m.subject}</div>
                )}
                <div className="whitespace-pre-wrap">{m.bodyText}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest opacity-60">
                  {new Date(m.createdAt).toLocaleString()}
                  {m.direction === "out" &&
                    (m.deliveredAt
                      ? " · delivered"
                      : m.failedAt
                        ? ` · failed${m.errorMessage ? ` (${m.errorMessage})` : ""}`
                        : " · sending")}
                  {m.openedAt && " · opened"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-4 space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_1fr]">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Template
            </Label>
            <Select value={templateId} onValueChange={(v) => v && onApplyTemplate(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a template…" />
              </SelectTrigger>
              <SelectContent>
                {(templates.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
                {(templates.data ?? []).length === 0 && (
                  <SelectItem value="" disabled>
                    No templates yet — add some in Settings
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {preview.isFetching && (
              <p className="mt-1 text-[10px] text-muted-foreground">Rendering…</p>
            )}
          </div>
          <div>
            <Label htmlFor="subject" className="text-xs uppercase tracking-widest text-muted-foreground">
              Subject
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="(optional)"
            />
          </div>
        </div>

        <Textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            thread.channel === "sms"
              ? "Reply by text…"
              : "Reply by email…"
          }
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {thread.channel === "email" ? "Sends via Resend" : "SMS provider not wired"}
          </div>
          <Button onClick={onSend} disabled={!body.trim() || reply.isPending}>
            {reply.isPending ? "Sending…" : (
              <>
                <Send className="mr-1 h-3.5 w-3.5" />
                Send reply <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

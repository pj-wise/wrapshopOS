"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ProductPickerItem = {
  id: string;
  name: string;
  hint?: string;
};

/**
 * Compact search-and-select for the quote-builder line-item picker.
 *
 * Displays the currently-selected product on the trigger; opens a popover
 * with a text input at the top, up to `maxResults` filtered results, and a
 * pinned "+ New product…" action at the very top.
 *
 * Kept self-contained (no Base UI Combobox) since the surface area is small
 * and the flow is opinionated (case-insensitive substring, keyboard support
 * limited to Enter → first match).
 */
export function ProductPicker({
  value,
  items,
  onChange,
  onCreateNew,
  placeholder = "From catalog…",
  maxResults = 5,
  className,
}: {
  value: string | null;
  items: ProductPickerItem[];
  onChange: (id: string) => void;
  onCreateNew: () => void;
  placeholder?: string;
  maxResults?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = value ? items.find((i) => i.id === value) ?? null : null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? items.filter(
          (i) =>
            i.name.toLowerCase().includes(needle) ||
            (i.hint ?? "").toLowerCase().includes(needle),
        )
      : items;
    return list.slice(0, maxResults);
  }, [items, q, maxResults]);

  // Click-outside + Escape to close.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Focus the input as soon as the popover opens.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQ("");
    }
  }, [open]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none",
          "hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "dark:bg-input/30 dark:hover:bg-input/50",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="truncate text-left">
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          <div className="relative border-b p-1.5">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const first = filtered[0];
                  if (first) pick(first.id);
                }
              }}
              placeholder="Search products…"
              className="h-8 border-0 bg-transparent pl-7 focus-visible:ring-0"
            />
          </div>

          <ul className="max-h-64 overflow-y-auto p-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreateNew();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                New product…
              </button>
            </li>
            {filtered.length > 0 && <li className="my-1 border-t" />}
            {filtered.map((item) => {
              const isActive = selected?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                      isActive && "bg-accent/60",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {item.hint && (
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {item.hint}
                      </span>
                    )}
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && q.trim().length > 0 && (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                No matches for &ldquo;{q.trim()}&rdquo;.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

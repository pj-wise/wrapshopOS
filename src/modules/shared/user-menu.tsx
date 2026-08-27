"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function UserMenu({
  email,
  name,
  roleKey,
}: {
  email: string;
  name: string | null;
  roleKey: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
      >
        <div className="grid h-7 w-7 place-items-center rounded-full bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          <UserIcon className="h-4 w-4" />
        </div>
        <div className="hidden text-left md:block">
          <div className="font-medium leading-none">{name ?? email}</div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">
            {roleKey.replace(/_/g, " ")}
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-neutral-500" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-56 rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-3 py-2 text-xs text-neutral-500">{email}</div>
          <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

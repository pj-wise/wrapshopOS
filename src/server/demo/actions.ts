"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  DEMO_EMAIL,
  DEMO_MODE,
  DEMO_PASSWORD,
  DEMO_SESSION_COOKIE,
  DEMO_USER_ID,
} from "@/lib/demo";

/** Only same-origin paths — never let `?next=` bounce to another site. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function startDemoSession(next: string | undefined): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, DEMO_USER_ID, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(safeNext(next));
}

/** "Explore the demo" button — no credentials needed. */
export async function enterDemoAction(next?: string) {
  if (!DEMO_MODE) throw new Error("Demo mode is off.");
  await startDemoSession(next);
}

/** Email + password form in demo mode. Only the demo credentials work. */
export async function signInDemoAction(
  email: string,
  password: string,
  next?: string,
): Promise<{ ok: false; error: string }> {
  if (!DEMO_MODE) throw new Error("Demo mode is off.");
  if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    return { ok: false, error: `Wrong email or password. Use ${DEMO_EMAIL} / ${DEMO_PASSWORD}.` };
  }
  return startDemoSession(next);
}

export async function signOutDemoAction() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);
  redirect("/login");
}

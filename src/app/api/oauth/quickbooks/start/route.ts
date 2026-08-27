import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { env } from "@/env";
import {
  buildAuthorizeUrl,
  generateState,
  isQboConfigured,
} from "@/server/integrations/quickbooks/oauth";
import { getAppSession } from "@/server/auth/session";

/**
 * Kick off the QBO OAuth flow. Verifies the caller is an authenticated
 * admin, stashes `state` + `orgId` into a signed HttpOnly cookie, and
 * redirects to Intuit's consent screen.
 *
 * The callback route reads the cookie to (a) match `state` and (b) know
 * which org to write the connection into.
 */
export async function GET(_req: Request) {
  if (!isQboConfigured()) {
    return NextResponse.json(
      {
        error:
          "QuickBooks is not configured. Set QBO_CLIENT_ID + QBO_CLIENT_SECRET in your env.",
      },
      { status: 501 },
    );
  }

  const session = await getAppSession();
  if (!session.permissions.has("admin:integrations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const state = generateState();
  const cookieStore = await cookies();
  cookieStore.set(
    "qbo_oauth",
    JSON.stringify({ state, orgId: session.organizationId, userId: session.userId }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 15 * 60,
      path: "/",
    },
  );

  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/oauth/quickbooks/callback`;
  const url = buildAuthorizeUrl({ state, redirectUri });
  return NextResponse.redirect(url, 302);
}

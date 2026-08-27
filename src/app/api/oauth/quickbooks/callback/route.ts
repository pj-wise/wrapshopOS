import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { env } from "@/env";
import { exchangeCodeForTokens } from "@/server/integrations/quickbooks/oauth";
import { persistTokens, getQuickBooksClient } from "@/server/integrations/quickbooks/client";
import { recordTimelineEvent } from "@/server/audit/timeline";

/**
 * Intuit redirects back here with `code`, `state`, `realmId`.
 * Exchanges the code, encrypts + persists the tokens, and redirects to the
 * integrations page with a success or error flash query param.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const realmId = url.searchParams.get("realmId");
  const errorParam = url.searchParams.get("error");
  const flashRedirect = (kind: "success" | "error", detail?: string) => {
    const target = new URL("/admin/integrations", env.NEXT_PUBLIC_APP_URL);
    target.searchParams.set("qbo", kind);
    if (detail) target.searchParams.set("detail", detail);
    return NextResponse.redirect(target, 302);
  };

  if (errorParam) return flashRedirect("error", errorParam);
  if (!code || !state || !realmId) {
    return flashRedirect("error", "missing_params");
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get("qbo_oauth")?.value;
  cookieStore.delete("qbo_oauth");
  if (!raw) return flashRedirect("error", "missing_state_cookie");

  let parsed: { state: string; orgId: string; userId: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return flashRedirect("error", "bad_state_cookie");
  }
  if (parsed.state !== state) return flashRedirect("error", "state_mismatch");

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/oauth/quickbooks/callback`,
    });

    // Persist encrypted, then read back through the client to pull CompanyName.
    await persistTokens(parsed.orgId, tokens, {
      realmId,
      environment: env.QBO_ENVIRONMENT === "production" ? "production" : "sandbox",
      connectedByUserId: parsed.userId,
    });
    try {
      const client = await getQuickBooksClient(parsed.orgId);
      const info = await client.getCompanyInfo();
      await persistTokens(parsed.orgId, tokens, {
        realmId,
        companyName: info.CompanyInfo?.CompanyName ?? undefined,
      });
    } catch (err) {
      console.warn("[qbo.callback] company info lookup failed", err);
    }

    await recordTimelineEvent(parsed.orgId, {
      entityType: "customer" as never,
      entityId: parsed.orgId,
      kind: "accounting.connected",
      actorUserId: parsed.userId,
      data: { provider: "quickbooks", realmId },
    });

    return flashRedirect("success");
  } catch (err) {
    console.error("[qbo.callback] failed", err);
    return flashRedirect(
      "error",
      err instanceof Error ? err.message.slice(0, 200) : "unknown",
    );
  }
}

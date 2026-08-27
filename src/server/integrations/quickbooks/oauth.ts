import "server-only";

import crypto from "node:crypto";

import { env } from "@/env";

/**
 * QuickBooks Online OAuth helpers.
 *
 * Flow: /api/oauth/quickbooks/start builds an authorize URL and drops PKCE
 * verifier + state into a signed cookie. Intuit redirects the user back to
 * /api/oauth/quickbooks/callback with `code` + `state` + `realmId`. Callback
 * exchanges the code, decrypts the encrypted tokens, and writes an
 * AccountingConnection row.
 *
 * ASSUMPTIONS (per plan §5, verify before Phase 8 go-live):
 *   - Discovery endpoints: docs.intuit.com/quickbooks-online/2020-04/oauth
 *   - Scope `com.intuit.quickbooks.accounting` covers Customer + Invoice +
 *     Payment writes. If you need Payments Standard operations, also request
 *     `com.intuit.quickbooks.payment`.
 *   - Token endpoint: POST to
 *     https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
 *   - Callback query includes `realmId` (the QBO company id) alongside `code`.
 */

export const QBO_SCOPE = "com.intuit.quickbooks.accounting openid profile email";

const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

export function isQboConfigured(): boolean {
  return Boolean(env.QBO_CLIENT_ID && env.QBO_CLIENT_SECRET);
}

export function buildAuthorizeUrl(input: {
  state: string;
  scopes?: string;
  redirectUri: string;
}): string {
  const params = new URLSearchParams({
    client_id: env.QBO_CLIENT_ID ?? "",
    response_type: "code",
    scope: input.scopes ?? QBO_SCOPE,
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type QboTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;             // access token seconds
  x_refresh_token_expires_in: number; // refresh token seconds
  token_type: string;
};

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(input: {
  code: string;
  redirectUri: string;
}): Promise<QboTokenResponse> {
  if (!env.QBO_CLIENT_ID || !env.QBO_CLIENT_SECRET) {
    throw new Error("QBO_CLIENT_ID / QBO_CLIENT_SECRET missing in env");
  }
  const basic = Buffer.from(`${env.QBO_CLIENT_ID}:${env.QBO_CLIENT_SECRET}`).toString(
    "base64",
  );
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`QBO token exchange failed HTTP ${res.status}: ${body}`);
  }
  return (await res.json()) as QboTokenResponse;
}

export async function refreshTokens(refreshToken: string): Promise<QboTokenResponse> {
  if (!env.QBO_CLIENT_ID || !env.QBO_CLIENT_SECRET) {
    throw new Error("QBO_CLIENT_ID / QBO_CLIENT_SECRET missing in env");
  }
  const basic = Buffer.from(`${env.QBO_CLIENT_ID}:${env.QBO_CLIENT_SECRET}`).toString(
    "base64",
  );
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`QBO token refresh failed HTTP ${res.status}: ${body}`);
  }
  return (await res.json()) as QboTokenResponse;
}

/**
 * Cryptographically-strong URL-safe state for the OAuth handshake.
 */
export function generateState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

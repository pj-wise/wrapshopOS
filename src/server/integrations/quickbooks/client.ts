import "server-only";

import { env } from "@/env";
import { prisma } from "@/server/db";
import { decrypt, encrypt } from "@/server/security/encryption";

import { refreshTokens, type QboTokenResponse } from "./oauth";

/**
 * QuickBooksClient — narrow wrapper around the Intuit REST API for a single
 * org's connection. Handles:
 *   - transparent access-token refresh (near expiry OR on 401 with one retry)
 *   - minor-version pinning (`minorversion=70` — plan §5 assumption)
 *   - env-aware base URLs (sandbox vs production)
 *
 * Instantiate via `getQuickBooksClient(orgId)` — the factory loads the org's
 * AccountingConnection row + decrypts its tokens.
 */

const MINOR_VERSION = "70";
const REFRESH_BUFFER_SECONDS = 5 * 60; // refresh 5 min before expiry

type QboEnvironment = "sandbox" | "production";

const API_BASE = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com",
  production: "https://quickbooks.api.intuit.com",
} as const;

export type QuickBooksClient = ReturnType<typeof buildClient>;

async function loadConnection(orgId: string) {
  const conn = await prisma.accountingConnection.findFirst({
    where: { organizationId: orgId, provider: "quickbooks", status: { not: "disconnected" } },
  });
  if (!conn) throw new Error("QuickBooks not connected for this org");
  return conn;
}

export async function getQuickBooksClient(orgId: string): Promise<QuickBooksClient> {
  const conn = await loadConnection(orgId);
  return buildClient(orgId, conn);
}

type ConnectionRow = Awaited<ReturnType<typeof loadConnection>>;

function buildClient(orgId: string, connSnapshot: ConnectionRow) {
  let conn = connSnapshot;
  let accessToken = decrypt(conn.accessTokenEnc);
  let refreshToken = decrypt(conn.refreshTokenEnc);

  const baseUrl = API_BASE[conn.environment as QboEnvironment] ?? API_BASE.sandbox;

  async function ensureFresh(): Promise<void> {
    const now = Date.now();
    const expiresAtMs = conn.accessExpiresAt.getTime();
    if (expiresAtMs - now > REFRESH_BUFFER_SECONDS * 1000) return;
    await doRefresh();
  }

  async function doRefresh(): Promise<void> {
    try {
      const tokens = await refreshTokens(refreshToken);
      await persistTokens(orgId, tokens);
      // Reload from DB to keep the local snapshot in sync.
      const fresh = await prisma.accountingConnection.findFirst({
        where: { id: conn.id },
      });
      if (fresh) {
        conn = fresh;
        accessToken = decrypt(fresh.accessTokenEnc);
        refreshToken = decrypt(fresh.refreshTokenEnc);
      }
    } catch (err) {
      await prisma.accountingConnection.update({
        where: { id: conn.id },
        data: {
          status: "unauthorized",
          lastRefreshError:
            err instanceof Error ? err.message : "Unknown refresh failure",
        },
      });
      throw err;
    }
  }

  async function api<T>(path: string, init?: RequestInit, retriedOn401 = false): Promise<T> {
    await ensureFresh();
    const url = `${baseUrl}/v3/company/${conn.realmId}${path}${
      path.includes("?") ? "&" : "?"
    }minorversion=${MINOR_VERSION}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401 && !retriedOn401) {
      await doRefresh();
      return api(path, init, true);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`QBO ${init?.method ?? "GET"} ${path} failed HTTP ${res.status}: ${body}`);
    }
    return (await res.json()) as T;
  }

  return {
    get realmId() {
      return conn.realmId;
    },
    get environment() {
      return conn.environment as QboEnvironment;
    },
    get companyName() {
      return conn.companyName;
    },
    /** Low-level escape hatch. Prefer typed helpers below. */
    api,
    // ---- Typed helpers (extend as sync surface grows) ---------------------
    async getCompanyInfo(): Promise<{ CompanyInfo: { CompanyName: string } }> {
      return api(`/companyinfo/${conn.realmId}`);
    },
    async findCustomerByEmail(email: string): Promise<{ QueryResponse: { Customer?: Array<{ Id: string; DisplayName: string }> } }> {
      const q = encodeURIComponent(
        `select Id, DisplayName from Customer where PrimaryEmailAddr = '${email.replace(/'/g, "''")}'`,
      );
      return api(`/query?query=${q}`);
    },
    async createCustomer(input: { displayName: string; email?: string; phone?: string }): Promise<{ Customer: { Id: string } }> {
      const body = {
        DisplayName: input.displayName,
        PrimaryEmailAddr: input.email ? { Address: input.email } : undefined,
        PrimaryPhone: input.phone ? { FreeFormNumber: input.phone } : undefined,
      };
      return api(`/customer`, { method: "POST", body: JSON.stringify(body) });
    },
    async createInvoice(input: {
      customerExternalId: string;
      number: string;
      lines: Array<{
        description: string;
        quantity: number;
        unitPriceCents: number;
        itemExternalId?: string;
        taxable?: boolean;
      }>;
      dueDate?: string;
      memo?: string;
      allowOnlinePayment?: boolean;
    }): Promise<{
      Invoice: {
        Id: string;
        DocNumber?: string;
        Balance?: number;
        InvoiceLink?: string; // ASSUMPTION: current field for hosted-pay URL
      };
    }> {
      const body = {
        AutoDocNumber: false,
        DocNumber: input.number,
        CustomerRef: { value: input.customerExternalId },
        Line: input.lines.map((l) => ({
          DetailType: "SalesItemLineDetail",
          Amount: (l.unitPriceCents / 100) * l.quantity,
          Description: l.description,
          SalesItemLineDetail: {
            Qty: l.quantity,
            UnitPrice: l.unitPriceCents / 100,
            TaxCodeRef: l.taxable !== false ? { value: "TAX" } : undefined,
            ItemRef: l.itemExternalId ? { value: l.itemExternalId } : undefined,
          },
        })),
        AllowOnlineACHPayment: input.allowOnlinePayment ?? true,
        AllowOnlineCreditCardPayment: input.allowOnlinePayment ?? true,
        DueDate: input.dueDate,
        CustomerMemo: input.memo ? { value: input.memo } : undefined,
      };
      return api(`/invoice?include=invoiceLink`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    async getInvoice(externalId: string): Promise<{
      Invoice: {
        Id: string;
        Balance: number;
        DocNumber?: string;
        InvoiceLink?: string;
        EmailStatus?: string;
      };
    }> {
      return api(`/invoice/${externalId}?include=invoiceLink`);
    },
    async getPayment(externalId: string): Promise<{
      Payment: {
        Id: string;
        TotalAmt?: number;
        TxnDate?: string;
        CustomerRef?: { value: string };
        PaymentMethodRef?: { value: string; name?: string };
        Line?: Array<{
          Amount?: number;
          LinkedTxn?: Array<{ TxnId: string; TxnType: string }>;
        }>;
      };
    }> {
      return api(`/payment/${externalId}`);
    },
  };
}

/**
 * Persist a fresh token pair (called after both initial exchange + refresh).
 */
export async function persistTokens(
  orgId: string,
  tokens: QboTokenResponse,
  overrides: Partial<{
    realmId: string;
    companyName: string;
    environment: QboEnvironment;
    connectedByUserId: string;
  }> = {},
): Promise<void> {
  const now = Date.now();
  const accessExpiresAt = new Date(now + tokens.expires_in * 1000);
  const refreshExpiresAt = new Date(now + tokens.x_refresh_token_expires_in * 1000);

  const existing = await prisma.accountingConnection.findFirst({
    where: { organizationId: orgId, provider: "quickbooks" },
  });

  const data = {
    accessTokenEnc: encrypt(tokens.access_token),
    refreshTokenEnc: encrypt(tokens.refresh_token),
    accessExpiresAt,
    refreshExpiresAt,
    lastRefreshedAt: new Date(),
    lastRefreshError: null,
    status: "connected",
    ...(overrides.realmId ? { realmId: overrides.realmId } : {}),
    ...(overrides.companyName ? { companyName: overrides.companyName } : {}),
    ...(overrides.environment ? { environment: overrides.environment } : {}),
  };

  if (existing) {
    await prisma.accountingConnection.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  if (!overrides.realmId) {
    throw new Error("persistTokens: realmId required on first connection");
  }

  await prisma.accountingConnection.create({
    data: {
      organizationId: orgId,
      provider: "quickbooks",
      realmId: overrides.realmId,
      companyName: overrides.companyName ?? null,
      environment: overrides.environment ?? (env.QBO_ENVIRONMENT ?? "sandbox"),
      scopes: ["com.intuit.quickbooks.accounting"],
      connectedByUserId: overrides.connectedByUserId ?? null,
      ...data,
    },
  });
}

/**
 * Constant-time HMAC verify for Intuit webhook signatures. Header:
 * `intuit-signature: <base64 sha256(body, verifierToken)>`.
 * ASSUMPTION (plan §5): SHA-256 base64. Verify against a sandbox webhook.
 */
export { verifyHmacSha256 as verifyWebhookSignature } from "@/server/security/encryption";

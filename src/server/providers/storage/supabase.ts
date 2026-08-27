import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/env";
import type { StorageProvider, SignedDownloadUrl, SignedUploadUrl } from "../types";

const BUCKET = "wrapshop";
const DEFAULT_UPLOAD_TTL = 5 * 60; // 5 minutes
const DEFAULT_DOWNLOAD_TTL = 60 * 60; // 1 hour

/**
 * Supabase Storage-backed StorageProvider.
 *
 * Bucket layout: `orgs/<orgId>/<category>/<uuid>-<fileName>`.
 * The bucket is created lazily on first upload via `ensureBucket()`.
 * RLS on storage: the `orgs/<orgId>/*` prefix policy is added in Phase 3
 * when the customer/vehicle photo flows land.
 *
 * Signed upload URLs use Supabase's `createSignedUploadUrl` (returns a PUT
 * URL + token). Client uploads directly to storage without touching us.
 */
export function createSupabaseStorageProvider(): StorageProvider {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let bucketEnsured = false;
  async function ensureBucket() {
    if (bucketEnsured) return;
    const { data: buckets, error } = await client.storage.listBuckets();
    if (error) throw new Error(`storage: listBuckets failed — ${error.message}`);
    if (!buckets.some((b) => b.name === BUCKET)) {
      const { error: createErr } = await client.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024, // 50 MB
      });
      if (createErr && !createErr.message?.includes("already exists")) {
        throw new Error(`storage: createBucket failed — ${createErr.message}`);
      }
    }
    bucketEnsured = true;
  }

  return {
    name: "supabase_storage",

    async createUploadUrl(input) {
      await ensureBucket();
      const id = crypto.randomUUID();
      const safeName = input.fileName.replace(/[^\w.\-]/g, "_").slice(0, 120);
      const storagePath = `orgs/${input.orgId}/${input.category}/${id}-${safeName}`;

      const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);
      if (error) throw new Error(`storage: createSignedUploadUrl — ${error.message}`);

      return {
        url: data.signedUrl,
        method: "PUT" as const,
        storagePath,
        expiresAt: new Date(Date.now() + DEFAULT_UPLOAD_TTL * 1000).toISOString(),
      } satisfies SignedUploadUrl;
    },

    async createDownloadUrl(storagePath, ttlSeconds = DEFAULT_DOWNLOAD_TTL) {
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(storagePath, ttlSeconds);
      if (error) throw new Error(`storage: createSignedUrl — ${error.message}`);
      return {
        url: data.signedUrl,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      } satisfies SignedDownloadUrl;
    },

    async delete(storagePath) {
      const { error } = await client.storage.from(BUCKET).remove([storagePath]);
      if (error) throw new Error(`storage: delete — ${error.message}`);
    },

    async read(storagePath) {
      const { data, error } = await client.storage.from(BUCKET).download(storagePath);
      if (error || !data) throw new Error(`storage: download — ${error?.message ?? "unknown"}`);
      return await data.arrayBuffer();
    },

    async put(storagePath, body, mimeType) {
      await ensureBucket();
      const { error } = await client.storage.from(BUCKET).upload(storagePath, body, {
        contentType: mimeType,
        upsert: true,
      });
      if (error) throw new Error(`storage: put — ${error.message}`);
    },

    async healthCheck() {
      const start = Date.now();
      try {
        const { error } = await client.storage.listBuckets();
        return {
          ok: !error,
          latencyMs: Date.now() - start,
          message: error?.message,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          ok: false,
          latencyMs: Date.now() - start,
          message: err instanceof Error ? err.message : String(err),
          checkedAt: new Date().toISOString(),
        };
      }
    },
  };
}

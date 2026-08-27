import "server-only";

import crypto from "node:crypto";

import { env } from "@/env";

/**
 * AES-256-GCM encryption for at-rest secrets (OAuth tokens, webhook signing
 * verifiers, per-org API keys stashed in ExternalIntegration.config).
 *
 * Ciphertext format:
 *   `v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>`
 *
 * The `v1:` prefix reserves room for key rotation later — decrypt() dispatches
 * on the prefix so we can migrate to a new key/algorithm without a mass
 * re-encrypt.
 */

const CURRENT_VERSION = "v1";

function key(): Buffer {
  const hex = env.ENCRYPTION_KEY;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters). Generate with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CURRENT_VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4) throw new Error("Malformed ciphertext");
  const [version, ivHex, tagHex, ctHex] = parts;
  if (version !== "v1") {
    throw new Error(`Unsupported ciphertext version: ${version}`);
  }
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString("utf8");
}

/**
 * Verify an HMAC-SHA-256 signature. Constant-time comparison to defeat timing
 * attacks — used by the QBO webhook verifier + any future third-party webhook.
 */
export function verifyHmacSha256(
  body: string | Buffer,
  signatureBase64: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const expected = hmac.digest();
  const given = Buffer.from(signatureBase64, "base64");
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

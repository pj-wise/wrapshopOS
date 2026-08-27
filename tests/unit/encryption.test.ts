import { describe, expect, it, beforeAll } from "vitest";

describe("encryption", () => {
  beforeAll(() => {
    // Test-only key. NEVER used outside these unit tests.
    process.env.ENCRYPTION_KEY = "0".repeat(64);
    process.env.SKIP_ENV_VALIDATION = "1";
  });

  it("round-trips a plaintext", async () => {
    const { encrypt, decrypt } = await import("@/server/security/encryption");
    const secret = "sbp_abcdef0123456789";
    const enc = encrypt(secret);
    expect(enc).toMatch(/^v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(decrypt(enc)).toBe(secret);
  });

  it("rejects tampered ciphertext", async () => {
    const { encrypt, decrypt } = await import("@/server/security/encryption");
    const enc = encrypt("hello");
    const tampered = enc.replace(/.{2}$/, "00"); // flip last byte
    expect(() => decrypt(tampered)).toThrow();
  });

  it("produces different ciphertext for same plaintext (IV randomness)", async () => {
    const { encrypt } = await import("@/server/security/encryption");
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a).not.toBe(b);
  });

  it("HMAC verify matches", async () => {
    const { verifyHmacSha256 } = await import("@/server/security/encryption");
    const crypto = await import("node:crypto");
    const body = "hello world";
    const secret = "shhh";
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64");
    expect(verifyHmacSha256(body, sig, secret)).toBe(true);
    expect(verifyHmacSha256(body, sig, "wrong")).toBe(false);
  });
});

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function sessionKey(): Buffer {
  const secret = process.env.SF_SESSION_ENCRYPT_KEY;
  if (!secret) {
    throw new Error("SF_SESSION_ENCRYPT_KEY is not configured");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptPayload(json: string): string {
  const key = sessionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptPayload(payload: string): string {
  const key = sessionKey();
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

export function isSessionCryptoConfigured(): boolean {
  return Boolean(process.env.SF_SESSION_ENCRYPT_KEY);
}

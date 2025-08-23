// server-only
import { authenticator } from "otplib";
import crypto from "crypto";

const keyB64 = process.env.ENCRYPTION_KEY;
if (!keyB64) throw new Error("ENCRYPTION_KEY is not set");
const KEY = Buffer.from(keyB64, "base64");

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function buildKeyUri(secret: string, email: string): string {
  const issuer = process.env.TOTP_ISSUER || "MyApp";
  return authenticator.keyuri(email, issuer, secret);
}

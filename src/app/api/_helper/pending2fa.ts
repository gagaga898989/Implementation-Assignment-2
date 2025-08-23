// app/api/_helper/pending2fa.ts
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "p2f"; // pending 2FA cookie name
const DEFAULT_MAX_AGE = 60 * 10; // 10 minutes

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sign(data: string) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * セット（サーバ側で呼ぶ）
 */
export async function setPending2FA(userId: string, maxAgeSec = DEFAULT_MAX_AGE) {
  const payload = JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + maxAgeSec });
  const b64 = b64url(Buffer.from(payload));
  const sig = sign(b64);
  const cookieValue = `${b64}.${sig}`;

  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  cookieStore.set({
    name: COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    sameSite: "strict",
    secure: isProd,
    path: "/",
    maxAge: maxAgeSec,
  });
}

/**
 * クリア
 */
export async function clearPending2FA() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * 取得（値を使う側は await して使うこと）
 */
export async function getPending2FA(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const c = cookieStore.get(COOKIE_NAME);
  if (!c?.value) return null;

  const [b64, sig] = c.value.split(".");
  if (!b64 || !sig) return null;

  if (sign(b64) !== sig) return null;

  try {
    const json = Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    const payload = JSON.parse(json) as { sub: string; exp: number };
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

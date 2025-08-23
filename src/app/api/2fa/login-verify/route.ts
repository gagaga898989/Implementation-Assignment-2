import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { authenticator } from "otplib";
import { decrypt } from "@/app/lib/totp";
import { getPending2FA, clearPending2FA } from "@/app/api/_helper/pending2fa";
import crypto from "crypto";
import { createSession } from "@/app/api/_helper/createSession";
import { AUTH } from "@/config/auth";
import { createJwt } from "@/app/api/_helper/createJwt";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function hash(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: NextRequest) {
  const pending = await getPending2FA();
  if (!pending) {
    return NextResponse.json({ success: false, payload: null, message: "No pending 2FA" }, { status: 401 });
  }
  const { code } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: pending.userId } });
  if (!user?.twoFactorEnabled || !user.twoFactorSecretEnc) {
    return NextResponse.json({ success: false, payload: null, message: "2FA not enabled" }, { status: 400 });
  }

  const secret = decrypt(user.twoFactorSecretEnc);

  let ok = authenticator.verify({ token: code, secret });
  if (!ok) {
    const matched = await prisma.backupCode.findFirst({
      where: { userId: user.id, hash: hash(code), usedAt: null },
    });
    if (matched) {
      ok = true;
      await prisma.backupCode.update({ where: { id: matched.id }, data: { usedAt: new Date() } });
    }
  }

  if (!ok) {
    return NextResponse.json({ success: false, payload: null, message: "Invalid code" }, { status: 400 });
  }

  // 2FA成功 → 本セッション確立
  clearPending2FA();

  const tokenMaxAgeSeconds = 60 * 60 * 3; // 3時間
  if (AUTH.isSession) {
    await createSession(user.id, tokenMaxAgeSeconds);
    return NextResponse.json({ success: true, payload: null, message: "" });
  } else {
    const jwt = await createJwt(user, tokenMaxAgeSeconds);
    return NextResponse.json({ success: true, payload: jwt, message: "" });
  }
}

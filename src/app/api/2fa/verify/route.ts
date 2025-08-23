// app/api/2fa/verifity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { authenticator } from "otplib";
import { decrypt, encrypt } from "@/app/lib/totp";
import { getSessionUser } from "../../_helper/getSessionUser";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// otplib のバージョン差で 3 引数呼び出しが型エラーになるため、
// ここでオプションを設定（±1 タイムステップを許容）
authenticator.options = { window: 1 };

function hash(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function genBackupCodes(n = 10) {
  return Array.from({ length: n }, () => {
    const raw = crypto.randomBytes(6).toString("base64url"); // 8〜10文字程度
    return { raw, hash: hash(raw) };
  });
}

export async function POST(req: NextRequest) {
  // getSessionUser(req) が NextRequest を受け取りセッションから user を返す実装を想定
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const u = await prisma.user.findUnique({ where: { id: user.id } });

  if (!u?.twoFactorTempEnc) {
    return NextResponse.json({ error: "No setup in progress" }, { status: 400 });
  }

  // 復号して検証（authenticator.options で window を設定しているため check は2引数で呼ぶ）
  let secret: string;
  try {
    secret = decrypt(u.twoFactorTempEnc);
  } catch (e) {
    console.error("decrypt error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const ok = authenticator.check(code, secret);
  if (!ok) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const codes = genBackupCodes();
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecretEnc: encrypt(secret),
          twoFactorTempEnc: null,
        },
      }),
      prisma.backupCode.deleteMany({ where: { userId: user.id } }),
      prisma.backupCode.createMany({
        data: codes.map((c) => ({ userId: user.id, hash: c.hash })),
      }),
    ]);
  } catch (e) {
    console.error("prisma transaction error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, backupCodes: codes.map((c) => c.raw) });
}

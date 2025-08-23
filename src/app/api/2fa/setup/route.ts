import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { authenticator } from "otplib";
import { encrypt, buildKeyUri } from "@/app/lib/totp";
import { getSessionUser } from "@/app/api/_helper/getSessionUser";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = authenticator.generateSecret();
  const otpauth = buildKeyUri(secret, user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorTempEnc: encrypt(secret) },
  });

  return NextResponse.json({ otpauth });
}

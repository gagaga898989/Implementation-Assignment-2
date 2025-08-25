import { prisma } from "@/libs/prisma";
import { loginRequestSchema } from "@/app/_types/LoginRequest";
import { userProfileSchema } from "@/app/_types/UserProfile";
import type { UserProfile } from "@/app/_types/UserProfile";
import type { ApiResponse } from "@/app/_types/ApiResponse";
import { NextResponse, NextRequest } from "next/server";
import { createSession } from "@/app/api/_helper/createSession";
import { createJwt } from "@/app/api/_helper/createJwt";
import { AUTH } from "@/config/auth";
import bcrypt from "bcryptjs";
import { setPending2FA } from "@/app/api/_helper/pending2fa";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// 設定値（失敗回数とロック時間）
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const POST = async (req: NextRequest) => {
  try {
    const result = loginRequestSchema.safeParse(await req.json());
    if (!result.success) {
      const res: ApiResponse<null> = {
        success: false,
        payload: null,
        message: "リクエストボディの形式が不正です。",
      };
      return NextResponse.json(res);
    }

    const loginRequest = result.data;
    const user = await prisma.user.findUnique({
      where: { email: loginRequest.email },
    });

    const genericErrorMessage =
      "メールアドレスまたはパスワードの組み合わせが正しくありません。";

    if (!user) {
      return NextResponse.json({
        success: false,
        payload: null,
        message: genericErrorMessage,
      });
    }

    // ⏰ ロック中ならログイン拒否
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainMinutes = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / 60000,
      );
      return NextResponse.json({
        success: false,
        payload: null,
        message: `アカウントはロックされています。${remainMinutes}分後に再試行してください。`,
        errorCode: "ACCOUNT_LOCKED"
      });
    }

    const isValidPassword = await bcrypt.compare(
      loginRequest.password,
      user.password,
    );

    if (!isValidPassword) {
      // ❌ パスワード不一致 → 失敗回数を加算
      let failedAttempts = (user.failedAttempts ?? 0) + 1;
      let lockUntil: Date | null = null;

      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000); // ロック時間
        failedAttempts = 0; // 次回のためリセット
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts, lockUntil },
      });

      return NextResponse.json({
        success: false,
        payload: null,
        message: genericErrorMessage,
      });
    }

    // ✅ パスワード正しい → 失敗回数リセット
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockUntil: null },
    });

    const tokenMaxAgeSeconds = 60 * 60 * 3; // 3時間

    await setPending2FA(user.id);

    if (AUTH.isSession) {
      await createSession(user.id, tokenMaxAgeSeconds);

      const res: ApiResponse<UserProfile> = {
        success: true,
        payload: userProfileSchema.parse(user),
        message: "",
      };
      return NextResponse.json(res);
    } else {
      const jwt = await createJwt(user, tokenMaxAgeSeconds);
      const res: ApiResponse<string> = {
        success: true,
        payload: jwt,
        message: "",
      };
      return NextResponse.json(res);
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Internal Server Error";
    console.error("Login Error:", errorMsg);

    const res: ApiResponse<null> = {
      success: false,
      payload: null,
      message: "ログインに失敗しました。",
    };
    return NextResponse.json(res);
  }
};

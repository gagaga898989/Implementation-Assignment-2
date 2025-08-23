"use server";

import { prisma } from "@/libs/prisma";
import { signupRequestSchema } from "@/app/_types/SignupRequest";
import { userProfileSchema } from "@/app/_types/UserProfile";
import type { SignupRequest } from "@/app/_types/SignupRequest";
import type { UserProfile } from "@/app/_types/UserProfile";
import type { ServerActionResponse } from "@/app/_types/ServerActionResponse";
import bcrypt from "bcryptjs";


// ユーザのサインアップのサーバアクション
export const signupServerAction = async (
  signupRequest: SignupRequest,
): Promise<ServerActionResponse<UserProfile | null>> => {
  try {
    // 入力検証
    const payload = signupRequestSchema.parse(signupRequest);

    // 💡スパム登録対策（1秒遅延）
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 既に登録済みユーザの確認（メッセージは漏らさない）
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (existingUser) {
      return {
        success: false,
        payload: null,
        message: "登録に失敗しました。", // 詳細は内部でログに残す
      };
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(payload.password, 10);

    // ユーザの作成
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        password: hashedPassword,
        name: payload.name,
      },
    });

    // レスポンスの生成（パスワードは除外）
    const res: ServerActionResponse<UserProfile> = {
      success: true,
      payload: userProfileSchema.parse(user),
      message: "",
    };
    return res;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Internal Server Error";
    console.error("SignupServerAction Error:", errorMsg); // 内部ログ
    return {
      success: false,
      payload: null,
      message: "登録に失敗しました。", // ユーザ向けメッセージは安全なものに
    };
  }
};

import { prisma } from "@/libs/prisma";
import { NextResponse, NextRequest } from "next/server";
import type { ApiResponse } from "@/app/_types/ApiResponse";
import { cookies } from "next/headers";
import { CartItem, cartItemSchema } from "@/app/_types/CartItem";
import { CartSession } from "@prisma/client";

export const GET = async (req: NextRequest) => {
  try {
    const cKey = "cart_session_id";
    const sessionMaxAge = 60; // 3時間
    const now = new Date();

    const cookieStore = await cookies();
    const sessionId = cookieStore.get(cKey)?.value;

    // Cookie をセットする関数の定義
    const setSessionCookie = (id: string) => {
      cookieStore.set(cKey, id, {
        path: "/",
        maxAge: sessionMaxAge,
        // httpOnly: true, // 💀 コメントアウトするとXSS攻撃で窃取される可能性あり
        sameSite: "strict", // 💀 "none" にするとCSRF脆弱性
        secure: false,
      });
    };

    let session: CartSession | null = sessionId
      ? await prisma.cartSession.findUnique({ where: { id: sessionId } })
      : null;

    // セッションが存在しない、または期限切れなら新規作成
    if (!session || session.expiresAt <= now) {
      // セッションが期限切れの場合は削除
      if (session) {
        await prisma.cartSession.delete({ where: { id: session.id } });
      }

      // セッションの新規作成
      session = await prisma.cartSession.create({
        data: {
          expiresAt: new Date(now.getTime() + sessionMaxAge * 1000),
        },
      });

      // 新しいセッションIDをクッキーにセット
      setSessionCookie(session.id);

      // 空のカート情報を返す
      const res: ApiResponse<CartItem[]> = {
        success: true,
        payload: [],
        message: "",
      };
      // console.log(`■ 新規セッションを作成しました${session.id}`);
      return NextResponse.json(res);
    }

    // セッションが有効な場合、有効期限を延長
    const newExpiry = new Date(now.getTime() + sessionMaxAge * 1000);
    await prisma.cartSession.update({
      where: { id: session.id },
      data: { expiresAt: newExpiry },
    });

    // クッキーの有効期限も延長
    setSessionCookie(session.id);

    // セッションに紐づくカート情報を取得
    const cartItems = (await prisma.cartItem.findMany({
      where: { cartSessionId: session.id },
      select: {
        productId: true,
        quantity: true,
      },
      orderBy: {
        productId: "asc",
      },
    })) as CartItem[];

    const res: ApiResponse<CartItem[]> = {
      success: true,
      payload: cartItems,
      message: "",
    };
    return NextResponse.json(res);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Internal Server Error";
    console.error(errorMsg);

    const res: ApiResponse<null> = {
      success: false,
      payload: null,
      message: "カート内容の取得に失敗しました",
    };
    return NextResponse.json(res);
  }
};

export const PATCH = async (req: NextRequest) => {
  try {
    const cKey = "cart_session_id";
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(cKey)?.value;

    console.log(`■ セッションID: ${sessionId}`);

    if (!sessionId) {
      const res: ApiResponse<null> = {
        success: false,
        payload: null,
        message: "X01 セッションが存在しません。処理をキャンセルしました。",
      };
      return NextResponse.json(res);
    }

    const session = await prisma.cartSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.expiresAt <= new Date()) {
      const res: ApiResponse<null> = {
        success: false,
        payload: null,
        message: "X02 セッションが無効です。処理をキャンセルしました。",
      };
      return NextResponse.json(res);
    }

    // リクエストボディの検証（数量が0以上などはココで保証される）
    const cartItem = cartItemSchema.parse(await req.json());
    const { productId, quantity } = cartItem;

    // 商品IDの存在確認
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      const res: ApiResponse<null> = {
        success: false,
        payload: null,
        message: `X03 商品 ${productId} は存在しません。処理をキャンセルしました。`,
      };
      return NextResponse.json(res);
    }

    if (quantity === 0) {
      // 数量0ならカートから削除
      await prisma.cartItem.delete({
        where: {
          // cartSessionId_productId は
          // Prisma が @@unique([cartSessionId, productId])
          // によって 自動生成する複合一意制約の識別子名
          cartSessionId_productId: {
            cartSessionId: sessionId,
            productId: productId,
          },
        },
      });
    } else {
      // 存在すれば更新、なければ作成（UPSERT）
      await prisma.cartItem.upsert({
        where: {
          cartSessionId_productId: {
            cartSessionId: sessionId,
            productId: productId,
          },
        },
        update: {
          quantity,
        },
        create: {
          cartSessionId: sessionId,
          productId,
          quantity,
        },
      });
    }

    const res: ApiResponse<null> = {
      success: true,
      payload: null,
      message: "",
    };
    return NextResponse.json(res);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Internal Server Error";
    console.error(errorMsg);
    const res: ApiResponse<null> = {
      success: false,
      payload: null,
      message: "X04 カートの更新に失敗しました",
    };
    return NextResponse.json(res);
  }
};

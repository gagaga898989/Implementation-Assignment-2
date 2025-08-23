// app/api/_helper/getSessionUser.ts
import { NextRequest } from "next/server";
import { prisma } from "@/libs/prisma";

/**
 * セッション Cookie の候補名をいくつかチェックしてセッションを取得する
 * - 開発中は session_id などの名前を使うことがあるので複数を許容する
 */
export async function getSessionUser(req: NextRequest) {
  // cookie 名の候補。必要に応じて増やす
  const candidates = ["session_id", "sid", "session", "sessionId", "connect.sid"];

  let sessionId: string | null = null;
  for (const name of candidates) {
    const v = req.cookies.get(name)?.value;
    if (v) { sessionId = v; break; }
  }

  // JWT ベースの認証も将来サポートするなら Authorization ヘッダもチェック可能
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;
  return session.user;
}

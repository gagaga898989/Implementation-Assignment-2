"use client";

import { prisma } from "@/libs/prisma";
import React, { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useParams } from "next/navigation";
import { authenticator } from "otplib";

const buildOtpAuthUrl = (secret: string, email: string, issuer = "MyApp") => {
  // otpauth URL を手動で組み立てる（Google Authenticator 等が読み取れる形式）
  // 例: otpauth://totp/Issuer:email?secret=SECRET&issuer=Issuer&algorithm=SHA1&digits=6&period=30
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

const QRPage: React.FC = () => {
  const params = useParams();
  const email = Array.isArray(params.email) ? params.email[0] : (params.email ?? "");
  const [secret, setSecret] = useState<string>("");
  const [otpauthUrl, setOtpauthUrl] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [checkResult, setCheckResult] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;

    // 秘密鍵生成（短期間のデバッグ用。実運用はサーバで保存）
    const s = authenticator.generateSecret();
    setSecret(s);

    // otpauth URL を手動で作成（keyuri が型に無くてもこれでOK）
    const url = buildOtpAuthUrl(s, email, "MyApp");
    setOtpauthUrl(url);

    console.log("Secret (debug):", s);
    console.log("otpauth URL (debug):", url);
  }, [email]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret) {
      setCheckResult("secret がありません");
      return;
    }

    // authenticator.check は存在するはず（TOTP の検証）
    const ok = authenticator.check(code, secret);
    setCheckResult(ok ? "正しいコードです ✅" : "無効なコードです ❌");
  };

  return (
    <main className="flex flex-col items-center justify-center mt-20">
      <h1 className="text-2xl font-bold mb-4">2段階認証QRコード表示ページ</h1>

      {!email ? (
        <p className="text-red-600">URLパラメータに email が必要です。</p>
      ) : otpauthUrl ? (
        <>
          <QRCodeCanvas value={otpauthUrl} size={256} />
          <p className="mt-4">このQRコードをスマホの認証アプリで読み取ってください。</p>

          <form onSubmit={handleVerify} className="mt-6 flex flex-col items-center">
            <label className="mb-2">認証コードを入力（テスト用）</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="border px-2 py-1 rounded text-center"
            />
            <button type="submit" className="mt-2 px-4 py-1 rounded border">
              検証
            </button>
          </form>

          {checkResult && <p className="mt-3">{checkResult}</p>}

          <details className="mt-4 text-xs text-gray-600">
            <summary>デバッグ情報（本番では表示しないでください）</summary>
            <pre className="whitespace-pre-wrap break-words">{`secret: ${secret}\notpauth: ${otpauthUrl}`}</pre>
          </details>
        </>
      ) : (
        <p>QRコードを生成中...</p>
      )}
    </main>
  );
};

export default QRPage;

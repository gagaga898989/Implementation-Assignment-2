"use client";

import React, { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";

export default function QRSetupPage() {
  const router = useRouter();

  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [msg, setMsg] = useState("");
  const [enabled, setEnabled] = useState(false); // ← 成功フラグ

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/2fa/setup", { method: "POST" });
      if (!res.ok) {
        setMsg("セットアップ開始に失敗しました。");
        return;
      }
      const data = await res.json();
      setOtpauthUrl(data.otpauth);
    })();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.ok) {
      setBackupCodes(data.backupCodes ?? null);
      setEnabled(true); // ← 成功状態に
      setMsg("2FAを有効化しました。バックアップコードを必ず安全な場所に保存してください。");
    } else {
      setMsg(data.error ?? "検証に失敗しました");
    }
  };

  return (
    <main className="flex flex-col items-center mt-10">
      <h1 className="text-xl font-bold">2段階認証の設定</h1>

      {!otpauthUrl ? (
        <p className="mt-4">{msg || "QRコードを生成中..."}</p>
      ) : (
        <>
          <QRCodeCanvas value={otpauthUrl} size={256} />
          <p className="mt-3">認証アプリでスキャン後、表示された6桁コードを入力してください。</p>

          <form
            onSubmit={handleVerify}
            className="mt-4 flex flex-col items-center gap-2"
          >
            <input
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="border px-2 py-1 rounded text-center"
              placeholder="123456"
              aria-label="認証コード"
              disabled={enabled} // 成功後は入力不可
            />
            <button
              className="border rounded px-4 py-1"
              disabled={enabled} // 成功後は押せない
            >
              有効化
            </button>
          </form>

          {msg && <p className="mt-2">{msg}</p>}

          {/* 成功したらホームに戻るボタンを表示 */}
          {enabled && (
            <button
              type="button"
              className="mt-4 border rounded px-4 py-1"
              onClick={() => router.push("/")}
              aria-label="ホームに戻る"
            >
              ホームに戻る
            </button>
          )}

          {/* バックアップコードの表示（必要ならコメント解除）
          {backupCodes && (
            <div className="mt-4">
              <h2 className="font-semibold">バックアップコード（必ず保存）</h2>
              <ul className="mt-2 list-disc pl-5">
                {backupCodes.map((c) => (
                  <li key={c}>
                    <code>{c}</code>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-gray-500 mt-2">※ この画面でのみ表示されます。</p>
            </div>
          )}
          */}
        </>
      )}
    </main>
  );
}
